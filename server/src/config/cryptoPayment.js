const DEFAULT_PAYMENT_WALLET =
  "0x7Cd14DD705F5e05D8B1B9853245Cc60Bd8251Ff4";
const DEFAULT_BSC_RPC_URL = "https://bsc-dataseed.binance.org";
const DEFAULT_ETH_RPC_URL = "https://ethereum-rpc.publicnode.com";
const DEFAULT_BSC_USDT_CONTRACT =
  "0x55d398326f99059ff775485246999027b3197955";
const DEFAULT_BSC_USDC_CONTRACT =
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d";

const CRYPTO_ASSETS = {
  USDT: {
    network: "BNB Smart Chain",
    chainId: 56,
    assetType: "erc20",
    tokenAddressEnv: "BSC_USDT_CONTRACT",
    defaultTokenAddress: DEFAULT_BSC_USDT_CONTRACT,
    tokenDecimalsEnv: "BSC_USDT_DECIMALS",
    tokenDecimals: 18,
    rpcUrlEnv: "BSC_RPC_URL",
    defaultRpcUrl: DEFAULT_BSC_RPC_URL,
    minConfirmationsEnv: "BSC_MIN_CONFIRMATIONS",
    minConfirmations: 1,
    explorerTransactionUrl: "https://bscscan.com/tx",
    gasToken: "BNB",
  },
  USDC: {
    network: "BNB Smart Chain",
    chainId: 56,
    assetType: "erc20",
    tokenAddressEnv: "BSC_USDC_CONTRACT",
    defaultTokenAddress: DEFAULT_BSC_USDC_CONTRACT,
    tokenDecimalsEnv: "BSC_USDC_DECIMALS",
    tokenDecimals: 18,
    rpcUrlEnv: "BSC_RPC_URL",
    defaultRpcUrl: DEFAULT_BSC_RPC_URL,
    minConfirmationsEnv: "BSC_MIN_CONFIRMATIONS",
    minConfirmations: 1,
    explorerTransactionUrl: "https://bscscan.com/tx",
    gasToken: "BNB",
  },
  BNB: {
    network: "BNB Smart Chain",
    chainId: 56,
    assetType: "native",
    tokenDecimals: 18,
    rpcUrlEnv: "BSC_RPC_URL",
    defaultRpcUrl: DEFAULT_BSC_RPC_URL,
    minConfirmationsEnv: "BSC_MIN_CONFIRMATIONS",
    minConfirmations: 1,
    explorerTransactionUrl: "https://bscscan.com/tx",
    gasToken: "BNB",
  },
  ETH: {
    network: "Ethereum",
    chainId: 1,
    assetType: "native",
    tokenDecimals: 18,
    rpcUrlEnv: "ETH_RPC_URL",
    defaultRpcUrl: DEFAULT_ETH_RPC_URL,
    minConfirmationsEnv: "ETH_MIN_CONFIRMATIONS",
    minConfirmations: 1,
    explorerTransactionUrl: "https://etherscan.io/tx",
    gasToken: "ETH",
  },
};

function parseNonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

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

export function normalizeCryptoAsset(value) {
  const token = String(value || "USDT").trim().toUpperCase();
  return CRYPTO_ASSETS[token] ? token : "";
}

export function getSupportedCryptoAssets() {
  return Object.keys(CRYPTO_ASSETS);
}

export function getCryptoPaymentConfig(asset = "USDT") {
  const token = normalizeCryptoAsset(asset);
  const definition = CRYPTO_ASSETS[token];

  if (!definition) {
    return {
      configured: false,
      provider: "onchain",
      token: String(asset || "").toUpperCase(),
    };
  }

  const recipientAddress = normalizeEvmAddress(
    process.env.ROTAVOY_PAYMENT_WALLET || DEFAULT_PAYMENT_WALLET
  );
  const rpcUrl = String(
    process.env[definition.rpcUrlEnv] || definition.defaultRpcUrl
  ).trim();
  const tokenAddress =
    definition.assetType === "erc20"
      ? normalizeEvmAddress(
          process.env[definition.tokenAddressEnv] ||
            definition.defaultTokenAddress
        )
      : "";
  const tokenDecimals =
    definition.assetType === "erc20"
      ? parseNonNegativeInteger(
          process.env[definition.tokenDecimalsEnv],
          definition.tokenDecimals
        )
      : definition.tokenDecimals;
  const minConfirmations = parsePositiveInteger(
    process.env[definition.minConfirmationsEnv],
    definition.minConfirmations
  );

  return {
    configured: Boolean(
      recipientAddress &&
        rpcUrl &&
        (definition.assetType === "native" || tokenAddress)
    ),
    provider: "onchain",
    network: definition.network,
    chainId: definition.chainId,
    assetType: definition.assetType,
    token,
    tokenAddress,
    tokenDecimals,
    recipientAddress,
    rpcUrl,
    minConfirmations,
    explorerTransactionUrl: definition.explorerTransactionUrl,
    gasToken: definition.gasToken,
  };
}

export function getPublicCryptoPaymentConfig(asset = "USDT") {
  const config = getCryptoPaymentConfig(asset);

  return {
    configured: config.configured,
    provider: config.provider,
    network: config.network,
    chainId: config.chainId,
    assetType: config.assetType,
    token: config.token,
    tokenAddress: config.tokenAddress,
    tokenDecimals: config.tokenDecimals,
    recipientAddress: config.recipientAddress,
    explorerTransactionUrl: config.explorerTransactionUrl,
    gasToken: config.gasToken,
  };
}
