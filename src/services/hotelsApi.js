const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function hotelRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}/api/hotels${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.error) {
    throw new Error(
      payload?.message ||
        payload?.error?.message ||
        "Otel servisine şu anda ulaşılamıyor.",
    );
  }

  return payload;
}

export function listHotels({ countryCode = "TR", cityName, limit = 20, offset = 0 }) {
  const query = new URLSearchParams({
    countryCode,
    cityName,
    limit: String(limit),
    offset: String(offset),
  });

  return hotelRequest(`?${query.toString()}`, {
    method: "GET",
  });
}

export function getHotelDetails(hotelId) {
  return hotelRequest(`/${encodeURIComponent(hotelId)}`, {
    method: "GET",
  });
}

export function getHotelTranslation(hotelId, language) {
  const query = new URLSearchParams({ language });
  return hotelRequest(
    `/translations/${encodeURIComponent(hotelId)}?${query.toString()}`,
    { method: "GET" },
  );
}

export function searchHotelRates({
  hotelIds,
  checkin,
  checkout,
  adults,
  currency = "USD",
  guestNationality = "TR",
  maxRatesPerHotel = 3,
}) {
  return hotelRequest("/rates", {
    method: "POST",
    body: JSON.stringify({
      hotelIds,
      checkin,
      checkout,
      currency,
      guestNationality,
      occupancies: [{ adults }],
      maxRatesPerHotel,
      limit: hotelIds.length,
      timeout: 12,
    }),
  });
}

export function prebookHotel(offerId) {
  return hotelRequest("/prebook", {
    method: "POST",
    body: JSON.stringify({ offerId }),
  });
}

export function bookSandboxHotel({ prebookId, clientReference, holder, guests }) {
  return hotelRequest("/book-sandbox", {
    method: "POST",
    body: JSON.stringify({ prebookId, clientReference, holder, guests }),
  });
}

export function createTravelCheckout({ offerId, holder, guests }) {
  return hotelRequest("/checkout", {
    method: "POST",
    body: JSON.stringify({ offerId, holder, guests }),
  }).then((payload) => payload.booking);
}

export function verifyTravelPayment(clientReference, { transactionHash, payerAddress }) {
  return hotelRequest(`/${encodeURIComponent(clientReference)}/verify-payment`, {
    method: "POST",
    body: JSON.stringify({ transactionHash, payerAddress }),
  }).then((payload) => payload.booking);
}
