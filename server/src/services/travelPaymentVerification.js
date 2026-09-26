import { getCryptoPaymentConfig, normalizeEvmAddress, normalizeTransactionHash } from "../config/cryptoPayment.js";
import { TravelBooking } from "../models/TravelBooking.js";

const TRANSFER_SELECTOR = "0xa9059cbb";

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function rpc(url, method, params) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }) });
  if (!response.ok) throw httpError("Blockchain RPC request failed.", 502);
  const payload = await response.json();
  if (payload.error) throw httpError(payload.error.message || "Blockchain RPC returned an error.", 502);
  return payload.result;
}

function decodeTransfer(input) {
  const value = String(input || "").toLowerCase();
  if (!value.startsWith(TRANSFER_SELECTOR) || value.length < 138) throw httpError("Transaction is not a supported USDT transfer.", 400);
  const recipientAddress = normalizeEvmAddress(`0x${value.slice(34, 74)}`);
  const amountHex = value.slice(74, 138);
  if (!recipientAddress || !/^[a-f0-9]{64}$/.test(amountHex)) throw httpError("Transaction transfer data is invalid.", 400);
  return { recipientAddress, amountUnits: BigInt(`0x${amountHex}`) };
}

function amountToUnits(value, decimals) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw httpError("Travel payment amount is invalid.", 500);
  const [whole, fraction = ""] = amount.toFixed(2).split(".");
  return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(fraction.padEnd(decimals, "0").slice(0, decimals));
}

function hexNumber(value) {
  return /^0x[a-f0-9]+$/i.test(String(value || "")) ? Number.parseInt(value, 16) : null;
}

export async function verifyTravelCryptoPayment({ booking, transactionHash, payerAddress }) {
  const hash = normalizeTransactionHash(transactionHash);
  const requestedPayer = payerAddress ? normalizeEvmAddress(payerAddress) : "";
  if (!hash) throw httpError("A valid transaction hash is required.", 400);
  if (payerAddress && !requestedPayer) throw httpError("Payer wallet address is invalid.", 400);
  if (booking.paymentStatus === "paid") {
    if (booking.payment?.transactionHash === hash) return booking;
    throw httpError("This travel booking is already paid.", 409);
  }
  if (booking.status !== "awaiting_payment" || new Date(booking.paymentExpiresAt).getTime() <= Date.now()) {
    if (booking.status === "awaiting_payment") { booking.status = "expired"; await booking.save(); }
    throw httpError("The payment window expired. Start the reservation again.", 409);
  }
  const duplicate = await TravelBooking.findOne({ _id: { $ne: booking._id }, "payment.transactionHash": hash }).lean();
  if (duplicate) throw httpError("This transaction has already been used for another reservation.", 409);

  const config = getCryptoPaymentConfig();
  if (!config.rpcUrl || !config.tokenAddress || !config.recipientAddress) throw httpError("Crypto payment is not configured on the server.", 503);
  const [transaction, receipt] = await Promise.all([rpc(config.rpcUrl, "eth_getTransactionByHash", [hash]), rpc(config.rpcUrl, "eth_getTransactionReceipt", [hash])]);
  if (!transaction || !receipt) throw httpError("Transaction is not confirmed yet. Try verification again shortly.", 409);
  if (String(receipt.status).toLowerCase() !== "0x1") throw httpError("The blockchain transaction failed.", 409);
  const payer = normalizeEvmAddress(transaction.from);
  if (normalizeEvmAddress(transaction.to) !== config.tokenAddress) throw httpError("Transaction used the wrong token contract.", 409);
  if (requestedPayer && requestedPayer !== payer) throw httpError("Transaction was sent from a different wallet.", 409);
  const transfer = decodeTransfer(transaction.input);
  if (transfer.recipientAddress !== config.recipientAddress) throw httpError("Transaction was sent to the wrong wallet.", 409);
  if (transfer.amountUnits < amountToUnits(booking.payment.expectedAmount || booking.total, config.tokenDecimals)) throw httpError("Transaction amount is lower than the reservation total.", 409);
  const [currentBlock, transactionBlock] = await Promise.all([rpc(config.rpcUrl, "eth_blockNumber", []), Promise.resolve(receipt.blockNumber)]);
  const confirmations = Math.max((hexNumber(currentBlock) || 0) - (hexNumber(transactionBlock) || 0) + 1, 0);
  if (confirmations < config.minConfirmations) throw httpError(`Transaction needs ${config.minConfirmations} confirmation(s). Current: ${confirmations}.`, 409);
  booking.status = "processing";
  booking.paymentStatus = "paid";
  booking.payment = { ...booking.payment, provider: "onchain", network: config.network, chainId: config.chainId, token: config.token, tokenAddress: config.tokenAddress, tokenDecimals: config.tokenDecimals, recipientAddress: config.recipientAddress, payerAddress: payer, transactionHash: hash, expectedAmount: String(booking.total), amount: String(booking.total), currency: config.token, blockNumber: hexNumber(transactionBlock), confirmations, confirmedAt: new Date() };
  booking.paymentExpiresAt = null;
  try { await booking.save(); } catch (error) { if (error?.code === 11000) throw httpError("This transaction has already been used for another reservation.", 409); throw error; }
  return booking;
}
