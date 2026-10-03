const DEFAULT_PAYMENT_WALLET =
  "0x7Cd14DD705F5e05D8B1B9853245Cc60Bd8251Ff4";
const DEFAULT_BSC_RPC_URL = "https://bsc-dataseed.binance.org";
const DEFAULT_ETH_RPC_URL = "https://ethereum-rpc.publicnode.com";

const DEFAULT_BSC_USDT_CONTRACT =
  "0x55d398326f99059ff775485246999027b3197955";
const DEFAULT_BSC_USDC_CONTRACT =
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d";
const DEFAULT_ETH_USDT_CONTRACT =
  "0xdac17f958d2ee523a2206206994597c13d831ec7";
const DEFAULT_ETH_USDC_CONTRACT =
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

const NETWORKS = {
  BSC: {
    network: "BNB Smart Chain",
    chainId: 56,
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
    rpcUrlEnv: "ETH_RPC_URL",
    defaultRpcUrl: DEFAULT_ETH_RPC_URL,
    minConfirmationsEnv: "ETH_MIN_CONFIRMATIONS",
    minConfirmations: 1,
    explorerTransactionUrl: "https://etherscan.io/tx",
    gasToken: "ETH",
  },
};

const CRYPTO_ASSETS = {
  USDT: {
    BSC: {
      assetType: "erc20",
      tokenAddressEnv: "BSC_USDT_CONTRACT",
      defaultTokenAddress: DEFAULT_BSC_USDT_CONTRACT,
      tokenDecimalsEnv: "BSC_USDT_DECIMALS",
      tokenDecimals: 18,
    },
    ETH: {
      assetType: "erc20",
      tokenAddressEnv: "ETH_USDT_CONTRACT",
      defaultTokenAddress: DEFAULT_ETH_USDT_CONTRACT,
      tokenDecimalsEnv: "ETH_USDT_DECIMALS",
      tokenDecimals: 6,
    },
  },
  USDC: {
    BSC: {
      assetType: "erc20",
      tokenAddressEnv: "BSC_USDC_CONTRACT",
      defaultTokenAddress: DEFAULT_BSC_USDC_CONTRACT,
      tokenDecimalsEnv: "BSC_USDC_DECIMALS",
      tokenDecimals: 18,
    },
    ETH: {
      assetType: "erc20",
      tokenAddressEnv: "ETH_USDC_CONTRACT",
      defaultTokenAddress: DEFAULT_ETH_USDC_CONTRACT,
      tokenDecimalsEnv: "ETH_USDC_DECIMALS",
      tokenDecimals: 6,
    },
  },
  BNB: {
    BSC: {
      assetType: "native",
      tokenDecimals: 18,
    },
  },
  ETH: {
    ETH: {
      assetType: "native",
      tokenDecimals: 18,
    },
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

export function normalizeCryptoNetwork(value, asset = "USDT") {
  const token = normalizeCryptoAsset(asset);
  if (!token) return "";

  const raw = String(value ?? "").trim().toUpperCase();
  let networkKey = "";

  if (["56", "BSC", "BNB", "BNB CHAIN", "BNB SMART CHAIN"].includes(raw)) {
    networkKey = "BSC";
  } else if (["1", "ETH", "ETHEREUM", "ETHEREUM MAINNET"].includes(raw)) {
    networkKey = "ETH";
  } else if (!raw) {
    networkKey = token === "ETH" ? "ETH" : "BSC";
  }

  return CRYPTO_ASSETS[token]?.[networkKey] ? networkKey : "";
}

export function getSupportedCryptoAssets() {
  return Object.entries(CRYPTO_ASSETS).flatMap(([token, networks]) =>
    Object.keys(networks).map((networkKey) => ({ token, networkKey }))
  );
}

export function getCryptoPaymentConfig(asset = "USDT", network = "") {
  const token = normalizeCryptoAsset(asset);
  const networkKey = normalizeCryptoNetwork(network, token);
  const assetDefinition = CRYPTO_ASSETS[token]?.[networkKey];
  const networkDefinition = NETWORKS[networkKey];

  if (!token || !networkKey || !assetDefinition || !networkDefinition) {
    return {
      configured: false,
      provider: "onchain",
      token: String(asset || "").toUpperCase(),
      networkKey: String(network || "").toUpperCase(),
    };
  }

  const recipientAddress = normalizeEvmAddress(
    process.env.ROTAVOY_PAYMENT_WALLET || DEFAULT_PAYMENT_WALLET
  );
  const rpcUrl = String(
    process.env[networkDefinition.rpcUrlEnv] || networkDefinition.defaultRpcUrl
  ).trim();
  const tokenAddress =
    assetDefinition.assetType === "erc20"
      ? normalizeEvmAddress(
          process.env[assetDefinition.tokenAddressEnv] ||
            assetDefinition.defaultTokenAddress
        )
      : "";
  const tokenDecimals =
    assetDefinition.assetType === "erc20"
      ? parseNonNegativeInteger(
          process.env[assetDefinition.tokenDecimalsEnv],
          assetDefinition.tokenDecimals
        )
      : assetDefinition.tokenDecimals;
  const minConfirmations = parsePositiveInteger(
    process.env[networkDefinition.minConfirmationsEnv],
    networkDefinition.minConfirmations
  );

  return {
    configured: Boolean(
      recipientAddress &&
        rpcUrl &&
        (assetDefinition.assetType === "native" || tokenAddress)
    ),
    provider: "onchain",
    networkKey,
    network: networkDefinition.network,
    chainId: networkDefinition.chainId,
    assetType: assetDefinition.assetType,
    token,
    tokenAddress,
    tokenDecimals,
    recipientAddress,
    rpcUrl,
    minConfirmations,
    explorerTransactionUrl: networkDefinition.explorerTransactionUrl,
    gasToken: networkDefinition.gasToken,
  };
}

export function getPublicCryptoPaymentConfig(asset = "USDT", network = "") {
  const config = getCryptoPaymentConfig(asset, network);

  return {
    configured: config.configured,
    provider: config.provider,
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
  };
}
