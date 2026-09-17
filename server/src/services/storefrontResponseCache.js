const DEFAULT_TTL_MS = 60 * 1000;
const DEFAULT_MAX_ENTRIES = 300;

const responseCache = new Map();
const inFlightRequests = new Map();

function pruneExpiredEntries(now = Date.now()) {
  for (const [key, entry] of responseCache) {
    if (!entry || entry.expiresAt <= now) responseCache.delete(key);
  }
}

function enforceMaxEntries(maxEntries) {
  if (responseCache.size <= maxEntries) return;

  const overflow = responseCache.size - maxEntries;
  const oldestKeys = [...responseCache.entries()]
    .sort((left, right) => Number(left[1]?.cachedAt || 0) - Number(right[1]?.cachedAt || 0))
    .slice(0, overflow)
    .map(([key]) => key);

  for (const key of oldestKeys) responseCache.delete(key);
}

export function readStorefrontResponseCache(key) {
  const cacheKey = String(key || "");
  if (!cacheKey) return null;

  const entry = responseCache.get(cacheKey);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }

  return entry.value;
}

export function writeStorefrontResponseCache(
  key,
  value,
  { ttlMs = DEFAULT_TTL_MS, maxEntries = DEFAULT_MAX_ENTRIES } = {},
) {
  const cacheKey = String(key || "");
  if (!cacheKey) return value;

  const now = Date.now();
  pruneExpiredEntries(now);
  responseCache.set(cacheKey, {
    value,
    cachedAt: now,
    expiresAt: now + Math.max(Number(ttlMs) || DEFAULT_TTL_MS, 1_000),
  });
  enforceMaxEntries(Math.max(Number(maxEntries) || DEFAULT_MAX_ENTRIES, 25));
  return value;
}

export async function withStorefrontResponseCache(
  key,
  factory,
  options = {},
) {
  const cacheKey = String(key || "");
  if (!cacheKey) return factory();

  const cached = readStorefrontResponseCache(cacheKey);
  if (cached !== null) return cached;

  const existingRequest = inFlightRequests.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = Promise.resolve()
    .then(factory)
    .then((value) => writeStorefrontResponseCache(cacheKey, value, options))
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, request);
  return request;
}

export function clearStorefrontResponseCache(prefix = "") {
  const safePrefix = String(prefix || "");
  if (!safePrefix) {
    responseCache.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    if (key.startsWith(safePrefix)) responseCache.delete(key);
  }
}
