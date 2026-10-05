import {
  getCryptoPaymentConfig,
  normalizeEvmAddress,
  normalizeTransactionHash,
} from "../config/cryptoPayment.js";
import { TravelBooking } from "../models/TravelBooking.js";

const TRANSFER_SELECTOR = "0xa9059cbb";

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function rpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw httpError("Blockchain RPC request failed.", 502);
  }

  const payload = await response.json();
  if (payload.error) {
    throw httpError(
      payload.error.message || "Blockchain RPC returned an error.",
      502
    );
  }

  return payload.result;
}

function decodeTransfer(input) {
  const value = String(input || "").toLowerCase();

  if (!value.startsWith(TRANSFER_SELECTOR) || value.length < 138) {
    throw httpError(
      "Transaction is not a supported token transfer.",
      400
    );
  }

  const recipientAddress = normalizeEvmAddress(
    `0x${value.slice(34, 74)}`
  );
  const amountHex = value.slice(74, 138);

  if (
    !recipientAddress ||
    !/^[a-f0-9]{64}$/.test(amountHex)
  ) {
    throw httpError("Transaction transfer data is invalid.", 400);
  }

  return {
    recipientAddress,
    amountUnits: BigInt(`0x${amountHex}`),
  };
}

function amountToUnits(value, decimals) {
  const text = String(value || "").trim();

  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    throw httpError("Travel payment amount is invalid.", 500);
  }

  const [whole, fraction = ""] = text.split(".");
  const normalizedFraction = fraction
    .padEnd(decimals, "0")
    .slice(0, decimals);

  return (
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(normalizedFraction || "0")
  );
}

function hexNumber(value) {
  return /^0x[a-f0-9]+$/i.test(String(value || ""))
    ? Number.parseInt(value, 16)
    : null;
}

function hexBigInt(value) {
  return /^0x[a-f0-9]+$/i.test(String(value || ""))
    ? BigInt(value)
    : 0n;
}

export async function verifyTravelCryptoPayment({
  booking,
  transactionHash,
  payerAddress,
}) {
  const hash = normalizeTransactionHash(transactionHash);
  const requestedPayer = payerAddress
    ? normalizeEvmAddress(payerAddress)
    : "";

  if (!hash) {
    throw httpError("A valid transaction hash is required.", 400);
  }
  if (payerAddress && !requestedPayer) {
    throw httpError("Payer wallet address is invalid.", 400);
  }

  if (booking.paymentStatus === "paid") {
    if (booking.payment?.transactionHash === hash) return booking;
    throw httpError("This travel booking is already paid.", 409);
  }

  if (!['awaiting_payment', 'expired'].includes(booking.status) || !booking.paymentExpiresAt) {
    throw httpError("This reservation is not awaiting a crypto payment.", 409);
  }

  const duplicate = await TravelBooking.findOne({
    _id: { $ne: booking._id },
    "payment.transactionHash": hash,
  }).lean();

  if (duplicate) {
    throw httpError(
      "This transaction has already been used for another reservation.",
      409
    );
  }

  const paymentToken = booking.payment?.token || "USDT";
  const paymentNetwork =
    booking.payment?.networkKey || booking.payment?.chainId || "";
  const config = getCryptoPaymentConfig(paymentToken, paymentNetwork);

  if (
    !config.configured ||
    !config.rpcUrl ||
    !config.recipientAddress
  ) {
    throw httpError(
      "Crypto payment is not configured on the server.",
      503
    );
  }

  if (
    Number(booking.payment?.chainId || config.chainId) !==
    config.chainId
  ) {
    throw httpError(
      "The booking payment network does not match the configured network.",
      409
    );
  }

  const [transaction, receipt, chainId] = await Promise.all([
    rpc(config.rpcUrl, "eth_getTransactionByHash", [hash]),
    rpc(config.rpcUrl, "eth_getTransactionReceipt", [hash]),
    rpc(config.rpcUrl, "eth_chainId", []),
  ]);

  if (hexNumber(chainId) !== config.chainId) throw httpError("Blockchain RPC network does not match the payment network.", 503);

  if (!transaction || !receipt) {
    throw httpError(
      "Transaction is not confirmed yet. Try verification again shortly.",
      409
    );
  }

  if (String(receipt.status).toLowerCase() !== "0x1") {
    throw httpError("The blockchain transaction failed.", 409);
  }

  const payer = normalizeEvmAddress(transaction.from);
  if (requestedPayer && requestedPayer !== payer) {
    throw httpError(
      "Transaction was sent from a different wallet.",
      409
    );
  }

  const expectedAmount = String(
    booking.payment?.expectedAmount || booking.total
  );
  const expectedUnits = amountToUnits(
    expectedAmount,
    config.tokenDecimals
  );

  let receivedUnits;

  if (config.assetType === "erc20") {
    if (
      normalizeEvmAddress(transaction.to) !== config.tokenAddress
    ) {
      throw httpError(
        "Transaction used the wrong token contract.",
        409
      );
    }

    const transfer = decodeTransfer(transaction.input);

    if (transfer.recipientAddress !== config.recipientAddress) {
      throw httpError(
        "Transaction was sent to the wrong wallet.",
        409
      );
    }

    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const recipientTopic = `0x${config.recipientAddress.slice(2).padStart(64, "0")}`;
    const matching = (receipt.logs || []).filter(log => normalizeEvmAddress(log.address) === config.tokenAddress && log.topics?.[0]?.toLowerCase() === transferTopic && log.topics?.[2]?.toLowerCase() === recipientTopic && normalizeEvmAddress(`0x${log.topics?.[1]?.slice(-40)}`) === payer);
    receivedUnits = matching.reduce((sum, log) => sum + hexBigInt(log.data), 0n);
    if (!matching.length) throw httpError("Token transfer receipt could not be verified.", 409);
  } else {
    if (
      normalizeEvmAddress(transaction.to) !== config.recipientAddress
    ) {
      throw httpError(
        "Transaction was sent to the wrong wallet.",
        409
      );
    }

    const input = String(transaction.input || "0x").toLowerCase();
    if (input !== "0x" && input !== "") {
      throw httpError(
        "Native coin payment must be a direct wallet transfer.",
        409
      );
    }

    receivedUnits = hexBigInt(transaction.value);
  }

  if (receivedUnits < expectedUnits) {
    throw httpError(
      "Transaction amount is lower than the booking total.",
      409
    );
  }

  const [currentBlock, transactionBlock] = await Promise.all([
    rpc(config.rpcUrl, "eth_blockNumber", []),
    Promise.resolve(receipt.blockNumber),
  ]);

  const confirmations = Math.max(
    (hexNumber(currentBlock) || 0) -
      (hexNumber(transactionBlock) || 0) +
      1,
    0
  );

  if (confirmations < config.minConfirmations) {
    throw httpError(
      `Transaction needs ${config.minConfirmations} confirmation(s). Current: ${confirmations}.`,
      409
    );
  }

  const block = await rpc(config.rpcUrl, "eth_getBlockByNumber", [receipt.blockNumber, false]);
  const paidAt = hexNumber(block?.timestamp) * 1000;
  if (!Number.isFinite(paidAt) || paidAt < new Date(booking.createdAt).getTime() - 60000 || paidAt > new Date(booking.paymentExpiresAt).getTime()) throw httpError("Transaction is outside this reservation's payment window.", 409);

  booking.status = "processing";
  booking.paymentStatus = "paid";
  booking.payment = {
    ...booking.payment,
    provider: "onchain",
    networkKey: config.networkKey,
    network: config.network,
    chainId: config.chainId,
    assetType: config.assetType,
    token: config.token,
    tokenAddress: config.tokenAddress,
    tokenDecimals: config.tokenDecimals,
    recipientAddress: config.recipientAddress,
    explorerTransactionUrl: config.explorerTransactionUrl,
    gasToken: config.gasToken,
    payerAddress: payer,
    transactionHash: hash,
    expectedAmount,
    amount: expectedAmount,
    currency: config.token,
    blockNumber: hexNumber(transactionBlock),
    confirmations,
    confirmedAt: new Date(),
  };
  booking.paymentExpiresAt = null;

  try {
    await booking.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw httpError(
        "This transaction has already been used for another reservation.",
        409
      );
    }
    throw error;
  }

  return booking;
}
