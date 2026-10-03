import { normalizeCryptoAsset } from "../config/cryptoPayment.js";

const PRICE_CACHE_TTL_MS = 45_000;
const PRICE_TIMEOUT_MS = 5_000;
const BINANCE_PRICE_URL =
  process.env.CRYPTO_PRICE_API_URL ||
  "https://api.binance.com/api/v3/ticker/price";

const priceCache = new Map();

function httpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function roundUp(value, decimals) {
  const factor = 10 ** decimals;
  return Math.ceil((value - Number.EPSILON) * factor) / factor;
}

async function fetchUsdPrice(asset) {
  if (asset === "USDT" || asset === "USDC") {
    return { price: 1, source: "usd-parity" };
  }

  const pair = asset === "BNB" ? "BNBUSDT" : asset === "ETH" ? "ETHUSDT" : "";
  if (!pair) {
    throw httpError("Unsupported crypto payment asset.", 400);
  }

  const cached = priceCache.get(pair);
  if (cached && cached.expiresAt > Date.now()) {
    return { price: cached.price, source: cached.source };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PRICE_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${BINANCE_PRICE_URL}?symbol=${encodeURIComponent(pair)}`,
      {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw httpError("Crypto market price service is unavailable.", 502);
    }

    const payload = await response.json();
    const price = Number(payload?.price);

    if (!Number.isFinite(price) || price <= 0) {
      throw httpError("Crypto market price could not be read.", 502);
    }

    const source = "binance";
    priceCache.set(pair, {
      price,
      source,
      expiresAt: Date.now() + PRICE_CACHE_TTL_MS,
    });

    return { price, source };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw httpError("Crypto market price request timed out.", 504);
    }
    if (error?.statusCode) throw error;
    throw httpError("Crypto market price service is unavailable.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function createCryptoPaymentQuote({ asset, usdAmount }) {
  const token = normalizeCryptoAsset(asset);
  const total = Number(usdAmount);

  if (!token) {
    throw httpError("Unsupported crypto payment asset.", 400);
  }

  if (!Number.isFinite(total) || total <= 0) {
    throw httpError("Travel payment amount is invalid.", 500);
  }

  const { price, source } = await fetchUsdPrice(token);
  const expectedAmount =
    token === "USDT" || token === "USDC"
      ? total.toFixed(2)
      : roundUp(total / price, 8).toFixed(8);

  return {
    token,
    expectedAmount,
    usdPrice: price.toFixed(8),
    quoteSource: source,
    quotedAt: new Date().toISOString(),
  };
}
