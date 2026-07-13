import { Order } from "../models/Order.js";
import {
  getCryptoPaymentConfig,
  normalizeEvmAddress,
  normalizeTransactionHash,
} from "../config/cryptoPayment.js";

const ERC20_TRANSFER_SELECTOR = "0xa9059cbb";

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function callRpc(rpcUrl, method, params) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw createHttpError("Blockchain RPC request failed.", 502);
    }

    const payload = await response.json();

    if (payload.error) {
      throw createHttpError(
        payload.error.message || "Blockchain RPC returned an error.",
        502
      );
    }

    return payload.result;
  } catch (error) {
    if (error.name === "AbortError") {
      throw createHttpError("Blockchain RPC request timed out.", 504);
    }

    if (error.statusCode) throw error;
    throw createHttpError("Blockchain RPC could not be reached.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function decodeTransferInput(input) {
  const normalizedInput = String(input || "").toLowerCase();

  if (
    !normalizedInput.startsWith(ERC20_TRANSFER_SELECTOR) ||
    normalizedInput.length < 138
  ) {
    throw createHttpError("Transaction is not a supported USDT transfer.", 400);
  }

  const recipientAddress = normalizeEvmAddress(
    `0x${normalizedInput.slice(34, 74)}`
  );
  const amountHex = normalizedInput.slice(74, 138);

  if (!recipientAddress || !/^[a-f0-9]{64}$/.test(amountHex)) {
    throw createHttpError("Transaction transfer data is invalid.", 400);
  }

  return {
    recipientAddress,
    amountUnits: BigInt(`0x${amountHex}`),
  };
}

function decimalToUnits(value, decimals) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw createHttpError("Order payment amount is invalid.", 500);
  }

  const decimalText = numericValue.toFixed(Math.min(2, decimals));
  const [wholePart, fractionPart = ""] = decimalText.split(".");
  const base = 10n ** BigInt(decimals);
  const fraction = fractionPart.padEnd(decimals, "0").slice(0, decimals);

  return BigInt(wholePart) * base + BigInt(fraction || "0");
}

function unitsToDecimal(value, decimals) {
  if (decimals === 0) return value.toString();

  const padded = value.toString().padStart(decimals + 1, "0");
  const wholePart = padded.slice(0, -decimals) || "0";
  const fractionPart = padded.slice(-decimals).replace(/0+$/, "");

  return fractionPart ? `${wholePart}.${fractionPart}` : wholePart;
}

function parseHexNumber(value) {
  if (!/^0x[a-f0-9]+$/i.test(String(value || ""))) return null;
  return Number.parseInt(value, 16);
}

export async function verifyCryptoPayment({
  order,
  transactionHash,
  payerAddress,
}) {
  const hash = normalizeTransactionHash(transactionHash);
  const requestedPayer = payerAddress
    ? normalizeEvmAddress(payerAddress)
    : "";

  if (!hash) {
    throw createHttpError("A valid transaction hash is required.", 400);
  }

  if (payerAddress && !requestedPayer) {
    throw createHttpError("Payer wallet address is invalid.", 400);
  }

  if (order.paymentMethod !== "crypto") {
    throw createHttpError("This order is not configured for crypto payment.", 409);
  }

  if (order.paymentStatus === "paid") {
    if (order.payment?.transactionHash === hash) return order;
    throw createHttpError("This order is already paid.", 409);
  }

  const reusedTransaction = await Order.findOne({
    _id: { $ne: order._id },
    "payment.transactionHash": hash,
  }).lean();

  if (reusedTransaction) {
    throw createHttpError(
      "This transaction has already been used for another order.",
      409
    );
  }

  const config = getCryptoPaymentConfig();
  const rpcUrl = config.rpcUrl;
  const tokenAddress = normalizeEvmAddress(
    order.payment?.tokenAddress || config.tokenAddress
  );
  const recipientAddress = normalizeEvmAddress(
    order.payment?.recipientAddress || config.recipientAddress
  );
  const tokenDecimals = Number(
    order.payment?.tokenDecimals || config.tokenDecimals
  );

  if (!rpcUrl || !tokenAddress || !recipientAddress) {
    throw createHttpError("Crypto payment is not configured on the server.", 503);
  }

  const [transaction, receipt] = await Promise.all([
    callRpc(rpcUrl, "eth_getTransactionByHash", [hash]),
    callRpc(rpcUrl, "eth_getTransactionReceipt", [hash]),
  ]);

  if (!transaction || !receipt) {
    throw createHttpError(
      "Transaction is not confirmed yet. Try verification again shortly.",
      409
    );
  }

  if (String(receipt.status).toLowerCase() !== "0x1") {
    throw createHttpError("The blockchain transaction failed.", 409);
  }

  const transactionContract = normalizeEvmAddress(transaction.to);
  const transactionPayer = normalizeEvmAddress(transaction.from);

  if (transactionContract !== tokenAddress) {
    throw createHttpError("Transaction used the wrong token contract.", 409);
  }

  if (requestedPayer && requestedPayer !== transactionPayer) {
    throw createHttpError("Transaction was sent from a different wallet.", 409);
  }

  const decodedTransfer = decodeTransferInput(transaction.input);

  if (decodedTransfer.recipientAddress !== recipientAddress) {
    throw createHttpError("Transaction was sent to the wrong wallet.", 409);
  }

  const expectedAmount = decimalToUnits(
    order.payment?.expectedAmount || order.total,
    tokenDecimals
  );

  if (decodedTransfer.amountUnits < expectedAmount) {
    throw createHttpError("Transaction amount is lower than the order total.", 409);
  }

  const currentBlockHex = await callRpc(rpcUrl, "eth_blockNumber", []);
  const currentBlock = parseHexNumber(currentBlockHex);
  const transactionBlock = parseHexNumber(receipt.blockNumber);

  if (currentBlock === null || transactionBlock === null) {
    throw createHttpError("Blockchain confirmation data is unavailable.", 502);
  }

  const confirmations = Math.max(currentBlock - transactionBlock + 1, 0);
  const requiredConfirmations = Math.max(config.minConfirmations, 1);

  if (confirmations < requiredConfirmations) {
    throw createHttpError(
      `Transaction needs ${requiredConfirmations} confirmation(s). Current: ${confirmations}.`,
      409
    );
  }

  order.status = "processing";
  order.paymentStatus = "paid";
  order.payment = {
    ...order.payment?.toObject?.(),
    provider: "onchain",
    network: order.payment?.network || config.network,
    chainId: Number(order.payment?.chainId || config.chainId),
    token: order.payment?.token || config.token,
    tokenAddress,
    tokenDecimals,
    payerAddress: transactionPayer,
    recipientAddress,
    transactionHash: hash,
    expectedAmount: String(order.payment?.expectedAmount || order.total),
    amount: unitsToDecimal(decodedTransfer.amountUnits, tokenDecimals),
    currency: order.payment?.currency || config.token,
    blockNumber: transactionBlock,
    confirmations,
    confirmedAt: new Date(),
    failedAt: null,
    failureReason: "",
  };

  await order.save();
  return order;
}
