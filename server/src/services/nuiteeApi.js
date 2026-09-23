const DATA_BASE_URL = "https://api.liteapi.travel/v3.0";
const BOOKING_BASE_URL = "https://book.liteapi.travel/v3.0";

function createNuiteeError(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getTimeoutMs() {
  const parsed = Number.parseInt(process.env.NUITEE_API_TIMEOUT_MS || "15000", 10);
  return Number.isInteger(parsed) && parsed >= 3000 ? parsed : 15000;
}

function getSettings() {
  const apiKey = String(process.env.NUITEE_API_KEY || "").trim();

  return {
    apiKey,
    environment: apiKey.startsWith("sand_") ? "sandbox" : apiKey ? "production" : "unconfigured",
    dataBaseUrl: String(process.env.NUITEE_DATA_BASE_URL || DATA_BASE_URL).replace(/\/$/, ""),
    bookingBaseUrl: String(process.env.NUITEE_BOOKING_BASE_URL || BOOKING_BASE_URL).replace(/\/$/, ""),
  };
}

function getUpstreamMessage(payload, status) {
  const candidate =
    payload?.error?.message ||
    payload?.error?.description ||
    payload?.message ||
    payload?.error;

  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : `Nuitee Connect request failed with status ${status}.`;
}

function mapStatus(status) {
  if (status === 408) return 504;
  if (status === 429) return 429;
  if (status >= 500) return 502;
  if (status >= 400) return 400;
  return 502;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestNuitee(
  baseUrl,
  path,
  { method = "GET", query, body, retries = 0 } = {},
) {
  const settings = getSettings();

  if (!settings.apiKey) {
    throw createNuiteeError("Nuitee Connect API key is not configured.", 503);
  }

  const url = new URL(`${baseUrl}${path}`);

  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "X-API-Key": settings.apiKey,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload = {};

    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = { message: raw.slice(0, 500) };
      }
    }

    if (!response.ok) {
      throw createNuiteeError(
        getUpstreamMessage(payload, response.status),
        mapStatus(response.status),
      );
    }

    return payload;
  } catch (error) {
    const retryable =
      error?.name === "AbortError" ||
      !error?.statusCode ||
      error.statusCode >= 500;

    if (retryable && retries > 0) {
      await wait(450);
      return requestNuitee(baseUrl, path, {
        method,
        query,
        body,
        retries: retries - 1,
      });
    }

    if (error?.statusCode) throw error;

    if (error?.name === "AbortError") {
      throw createNuiteeError("Nuitee Connect request timed out.", 504);
    }

    throw createNuiteeError(
      `Nuitee Connect could not be reached: ${error.message}`,
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function getNuiteeStatus() {
  const settings = getSettings();

  return {
    configured: Boolean(settings.apiKey),
    environment: settings.environment,
    sandboxBookingEnabled:
      settings.environment === "sandbox" &&
      String(process.env.NUITEE_ENABLE_SANDBOX_BOOKING || "").toLowerCase() === "true",
  };
}

export function listNuiteeHotels(query) {
  return requestNuitee(getSettings().dataBaseUrl, "/data/hotels", {
    query,
    retries: 1,
  });
}

export function searchNuiteeRates(body) {
  return requestNuitee(getSettings().dataBaseUrl, "/hotels/rates", {
    method: "POST",
    body,
    retries: 1,
  });
}

export function prebookNuiteeRate(body) {
  return requestNuitee(getSettings().bookingBaseUrl, "/rates/prebook", {
    method: "POST",
    query: { timeout: 30 },
    body,
  });
}

export function bookNuiteeSandbox(body) {
  const status = getNuiteeStatus();

  if (status.environment !== "sandbox" || !status.sandboxBookingEnabled) {
    throw createNuiteeError(
      "Sandbox hotel booking is disabled. Set NUITEE_ENABLE_SANDBOX_BOOKING=true only when intentionally testing a booking.",
      503,
    );
  }

  return requestNuitee(getSettings().bookingBaseUrl, "/rates/book", {
    method: "POST",
    query: { timeout: 30 },
    body: {
      ...body,
      payment: { method: "ACC_CREDIT_CARD" },
    },
  });
}
