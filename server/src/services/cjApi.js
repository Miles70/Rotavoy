const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";
const MIN_REQUEST_INTERVAL_MS = 1050;

let cachedToken = "";
let tokenExpiresAt = 0;
let requestQueue = Promise.resolve();
let lastRequestAt = 0;

function createCjError(message, statusCode = 502, payload = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.cjPayload = payload;
  return error;
}

function parseExpiry(value) {
  const parsed = Date.parse(String(value || ""));
  if (Number.isFinite(parsed)) return parsed;
  return Date.now() + 12 * 60 * 60 * 1000;
}

function enqueueRequest(task) {
  const run = requestQueue.then(async () => {
    const waitMs = Math.max(MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt), 0);
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    try {
      return await task();
    } finally {
      lastRequestAt = Date.now();
    }
  });
  requestQueue = run.catch(() => undefined);
  return run;
}

async function fetchJson(url, options = {}) {
  return enqueueRequest(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw createCjError(
          payload?.message || `CJ API request failed with ${response.status}.`,
          response.status >= 500 ? 502 : 400,
          payload,
        );
      }
      return payload;
    } catch (error) {
      if (error.name === "AbortError") throw createCjError("CJ API request timed out.", 504);
      if (error.statusCode) throw error;
      throw createCjError("CJ API could not be reached.", 502);
    } finally {
      clearTimeout(timeout);
    }
  });
}

function assertCjSuccess(payload) {
  if (payload?.result === true || payload?.success === true || payload?.code === 200) {
    return payload.data;
  }
  const message = String(payload?.message || "CJ API returned an error.");
  const authFailure = Number(payload?.code) === 1600001 || /auth|token|access/i.test(message);
  throw createCjError(message, authFailure ? 401 : 502, payload);
}

async function createAccessToken() {
  const apiKey = String(process.env.CJ_API_KEY || "").trim();
  if (!apiKey) throw createCjError("CJ_API_KEY is not configured on the server.", 503);
  const payload = await fetchJson(`${CJ_BASE_URL}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  const data = assertCjSuccess(payload);
  cachedToken = String(data?.accessToken || "").trim();
  if (!cachedToken) throw createCjError("CJ did not return an access token.", 502, payload);
  tokenExpiresAt = parseExpiry(data?.accessTokenExpiryDate);
  return cachedToken;
}

async function getAccessToken(forceRefresh = false) {
  const safeUntil = tokenExpiresAt - 5 * 60 * 1000;
  if (!forceRefresh && cachedToken && Date.now() < safeUntil) return cachedToken;
  cachedToken = "";
  tokenExpiresAt = 0;
  return createAccessToken();
}

function buildUrl(path, query = {}) {
  const url = new URL(`${CJ_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, String(item)));
    else url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function authenticatedRequest(path, { method = "GET", query = {}, body, retryAuth = true } = {}) {
  const token = await getAccessToken();
  const headers = {
    "CJ-Access-Token": token,
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
  };
  try {
    const payload = await fetchJson(buildUrl(path, query), {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return assertCjSuccess(payload);
  } catch (error) {
    if (retryAuth && error.statusCode === 401) {
      await getAccessToken(true);
      return authenticatedRequest(path, { method, query, body, retryAuth: false });
    }
    throw error;
  }
}

export function isCjConfigured() {
  return Boolean(String(process.env.CJ_API_KEY || "").trim());
}

export async function listCjProducts({ page = 1, size = 20, keyWord = "" } = {}) {
  return authenticatedRequest("/product/listV2", {
    query: {
      page,
      size,
      keyWord,
      features: ["enable_category", "enable_description"],
      productType: "ORDINARY_PRODUCT",
      verifiedWarehouse: 1,
    },
  });
}

export async function getCjProductDetail(pid) {
  return authenticatedRequest("/product/query", { query: { pid } });
}

export async function getCjVariantStock(vid) {
  return authenticatedRequest("/product/stock/queryByVid", { query: { vid } });
}

export async function calculateCjFreight({ endCountryCode, zip = "", products, startCountryCode = String(process.env.CJ_FROM_COUNTRY_CODE || "CN").toUpperCase() }) {
  return authenticatedRequest("/logistic/freightCalculate", {
    method: "POST",
    body: {
      startCountryCode,
      endCountryCode: String(endCountryCode || "").toUpperCase(),
      ...(zip ? { zip } : {}),
      products,
    },
  });
}

export async function createCjOrder(payload) {
  return authenticatedRequest("/shopping/order/createOrderV2", {
    method: "POST",
    body: payload,
  });
}
