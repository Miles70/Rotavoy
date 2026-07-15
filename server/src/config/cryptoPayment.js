const DEFAULT_BSC_RPC_URL = "https://bsc-dataseed.binance.org";
const DEFAULT_BSC_USDT_CONTRACT =
  "0x55d398326f99059ff775485246999027b3197955";

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeEvmAddress(value) {
  const address = String(value || "").trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(address) ? address : "";
}

export function normalizeTransactionHash(value) {
  const hash = String(value || "").trim().toLowerCase();
  return /^0x[a-f0-9]{64}$/.test(hash) ? hash : "";
}

export function getCryptoPaymentConfig() {
  const tokenAddress = normalizeEvmAddress(
    process.env.BSC_USDT_CONTRACT || DEFAULT_BSC_USDT_CONTRACT
  );
  const recipientAddress = normalizeEvmAddress(
    process.env.MASTEROTA_PAYMENT_WALLET
  );

  return {
    configured: Boolean(tokenAddress && recipientAddress),
    provider: "onchain",
    network: "BNB Smart Chain",
    chainId: 56,
    token: "USDT",
    tokenAddress,
    tokenDecimals: parsePositiveInteger(process.env.BSC_USDT_DECIMALS, 18),
    recipientAddress,
    rpcUrl: String(process.env.BSC_RPC_URL || DEFAULT_BSC_RPC_URL).trim(),
    minConfirmations: parsePositiveInteger(
      process.env.BSC_MIN_CONFIRMATIONS,
      1
    ),
  };
}

export function getPublicCryptoPaymentConfig() {
  const config = getCryptoPaymentConfig();

  return {
    configured: config.configured,
    provider: config.provider,
    network: config.network,
    chainId: config.chainId,
    token: config.token,
    tokenAddress: config.tokenAddress,
    tokenDecimals: config.tokenDecimals,
    recipientAddress: config.recipientAddress,
  };
}
