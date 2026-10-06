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
  const message =
    typeof payload?.error?.message === "string"
      ? payload.error.message.trim()
      : typeof payload?.message === "string"
        ? payload.message.trim()
        : "";
  const description =
    typeof payload?.error?.description === "string"
      ? payload.error.description.trim()
      : "";
  const code = payload?.error?.code;

  if (description) {
    const prefix = code !== undefined && code !== null ? `Nuitee ${code}: ` : "";
    return `${prefix}${description}${message && message !== description ? ` — ${message}` : ""}`;
  }

  const fallback =
    message ||
    (typeof payload?.error === "string" ? payload.error.trim() : "");

  return fallback || `Nuitee Connect request failed with status ${status}.`;
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
  { method = "GET", query, body, retries = 0, timeoutMs } = {},
) {
  const settings = getSettings();

  if (!settings.apiKey) {
    throw createNuiteeError("Nuitee Connect API key is not configured.", 503);
  }

  if (process.env.NODE_ENV === 'production' && settings.environment === 'sandbox') {
    throw createNuiteeError('Canlı ortamda Nuitee production API anahtarı gerekiyor.', 503);
  }
  const url = new URL(`${baseUrl}${path}`);

  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || getTimeoutMs());

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

    if (!response.ok || payload?.error) {
      const error = createNuiteeError(
        getUpstreamMessage(payload, response.status),
        mapStatus(response.status),
      );
      error.upstreamStatus = response.status;
      throw error;
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
        timeoutMs,
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

function bookingPerson(value, includeOccupancy = false) {
  const person = {
    firstName: String(value?.firstName || "").trim(),
    lastName: String(value?.lastName || "").trim(),
    email: String(value?.email || "").trim().toLowerCase(),
  };

  if (includeOccupancy) {
    person.occupancyNumber = Number(value?.occupancyNumber);
  }

  const remarks = String(value?.remarks || "").trim();
  if (remarks) person.remarks = remarks;

  return person;
}

export function getNuiteeStatus() {
  const settings = getSettings();

  return {
    configured: Boolean(settings.apiKey),
    environment: settings.environment,
    liveBookingEnabled: settings.environment === "production" && String(process.env.NUITEE_ENABLE_LIVE_BOOKING || "true").toLowerCase() === "true",
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

export function listNuiteeCountries() {
  return requestNuitee(getSettings().dataBaseUrl, "/data/countries", { retries: 1 });
}

export function searchNuiteePlaces(textQuery) {
  return requestNuitee(getSettings().dataBaseUrl, "/data/places", {
    query: { textQuery, type: "locality,administrative_area_level_1,country", language: "en" },
    retries: 1,
  });
}

export function getNuiteeHotel(hotelId) {
  return requestNuitee(getSettings().dataBaseUrl, "/data/hotel", {
    query: { hotelId },
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
    query: { timeout: 120 },
    timeoutMs: 125000,
    body,
  });
}

export function bookNuiteeTransaction(body) {
  assertBookingReady();
  const transactionId = String(body?.transactionId || "").trim();
  if (!transactionId) {
    throw createNuiteeError("Nuitee transactionId is required to finalize card payment.", 400);
  }

  const guests = Array.isArray(body?.guests)
    ? body.guests.map((guest) => bookingPerson(guest, true))
    : [];

  return requestNuitee(getSettings().bookingBaseUrl, "/rates/book", {
    method: "POST",
    query: { timeout: 120 },
    timeoutMs: 125000,
    body: {
      prebookId: String(body?.prebookId || "").trim(),
      ...(body?.clientReference
        ? { clientReference: String(body.clientReference).trim() }
        : {}),
      holder: bookingPerson(body?.holder),
      guests,
      payment: {
        method: "TRANSACTION_ID",
        transactionId,
      },
    },
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
    query: { timeout: 120 },
    timeoutMs: 125000,
    body: {
      ...body,
      payment: { method: "ACC_CREDIT_CARD" },
    },
  });
}

export function searchNuiteeAirports(q) {
  return requestNuitee(getSettings().dataBaseUrl, '/data/flights/airports', { query: { q } });
}

export function searchNuiteeFlights(body) {
  return requestNuitee(getSettings().dataBaseUrl, '/flights/rates', {
    method: 'POST', body, timeoutMs: 60000,
  });
}

export function verifyNuiteeFlight(offerId) {
  return requestNuitee(getSettings().dataBaseUrl, '/flights/verify', {
    method: 'POST', body: { offerId }, timeoutMs: 60000,
  });
}

export function assertBookingReady(method = 'card') {
  const status = getNuiteeStatus();
  if (!status.configured || (status.environment === 'production' && !status.liveBookingEnabled)) throw createNuiteeError('Rezervasyon servisi şu an kullanılamıyor.', 503);
  if (process.env.NODE_ENV === 'production' && status.environment !== 'production') throw createNuiteeError('Canlı rezervasyon için production anahtarı gerekiyor.', 503);
  if (method === 'account' && status.environment !== 'production') throw createNuiteeError('Kripto otel rezervasyonu için canlı sağlayıcı hesabı gerekiyor.', 503);
  return status;
}
export function bookNuiteeAccount(body) {
  assertBookingReady('account');
  const method = String(process.env.NUITEE_ACCOUNT_PAYMENT_METHOD || 'ACC_CREDIT_CARD');
  if (!['ACC_CREDIT_CARD', 'WALLET', 'CREDIT'].includes(method)) throw createNuiteeError('Sağlayıcı hesap ödeme yöntemi geçersiz.', 503);
  return requestNuitee(getSettings().bookingBaseUrl, '/rates/book', { method: 'POST', timeoutMs: 125000, query: { timeout: 120 }, body: { prebookId: body.prebookId, clientReference: body.clientReference, holder: bookingPerson(body.holder), guests: body.guests.map(g => bookingPerson(g, true)), customTags: { CHANNEL: 'ROTAVOY' }, payment: { method } } });
}
export function findNuiteeBooking(clientReference) {
  return requestNuitee(getSettings().bookingBaseUrl, '/bookings', { query: { clientReference, timeout: 30 }, timeoutMs: 35000 });
}
export function prebookNuiteeFlight(body) {
  assertBookingReady();
  return requestNuitee(getSettings().dataBaseUrl, '/flights/prebooks', { method: 'POST', body: { ...body, usePaymentSdk: true }, timeoutMs: 125000 });
}
export function bookNuiteeFlight(prebookId, transactionId) {
  assertBookingReady();
  return requestNuitee(getSettings().dataBaseUrl, '/flights/bookings', { method: 'POST', body: { prebookId, payment: { method: 'TRANSACTION_ID', transactionId }, customTags: { CHANNEL: 'ROTAVOY' } }, timeoutMs: 125000 });
}
export function getNuiteeFlightBooking(bookingId) {
  return requestNuitee(getSettings().dataBaseUrl, `/flights/bookings/${encodeURIComponent(bookingId)}`, { timeoutMs: 35000 });
}
