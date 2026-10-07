import { getCustomerAccessToken } from "./customerApi";
const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function storeBookingAccess(reference, token) {
  if (reference && token) sessionStorage.setItem(`rotavoy_booking_access:${reference}`, token);
}
export function bookingHeaders(reference) {
  const token = sessionStorage.getItem(`rotavoy_booking_access:${reference}`);
  return token ? { 'X-Booking-Token': token } : {};
}
async function hotelRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}/api/hotels${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(getCustomerAccessToken() ? { Authorization: `Bearer ${getCustomerAccessToken()}` } : {}),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.error) {
    const error = new Error(
      payload?.message ||
        payload?.error?.message ||
        "Otel servisine şu anda ulaşılamıyor.",
    );
    Object.assign(error, payload);
    throw error;
  }

  const reference = payload.booking?.clientReference;
  storeBookingAccess(reference, payload.accessToken);
  return payload;
}

export function listHotels({ countryCode = "TR", cityName, destination, placeId, latitude, longitude, radius = 10000, limit = 20, offset = 0 }) {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (latitude !== undefined && longitude !== undefined) {
    query.set("latitude", String(latitude));
    query.set("longitude", String(longitude));
    query.set("radius", String(radius));
  }
  else if (destination) query.set("destination", destination);
  else if (placeId) query.set("placeId", placeId);
  else {
    query.set("countryCode", countryCode);
    if (cityName) query.set("cityName", cityName);
  }

  return hotelRequest(`?${query.toString()}`, {
    method: "GET",
  });
}

export function getHotelDetails(hotelId) {
  return hotelRequest(`/${encodeURIComponent(hotelId)}`, {
    method: "GET",
  });
}

export function listIndexedVideoHotels(limit = 40) {
  const query = new URLSearchParams({ limit: String(limit) });
  return hotelRequest(`/video-showcase?${query.toString()}`, {
    method: "GET",
  });
}

export function listIndexedShowcaseHotels(limit = 80) {
  const query = new URLSearchParams({ limit: String(limit) });
  return hotelRequest(`/showcase-index?${query.toString()}`, {
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

export function createTravelCheckout({
  stay,
  offerId,
  holder,
  guests,
  acceptedTerms,
  cryptoAsset = "USDT",
  cryptoNetwork = "BSC",
}) {
  return hotelRequest("/crypto-checkout", {
    method: "POST",
    body: JSON.stringify({
      stay,
      offerId,
      holder,
      guests,
      acceptedTerms,
      cryptoAsset,
      cryptoNetwork,
    }),
  }).then((payload) => payload.booking);
}

export function verifyTravelPayment(clientReference, { transactionHash, payerAddress }) {
  return hotelRequest(`/${encodeURIComponent(clientReference)}/verify-payment`, {
    headers: bookingHeaders(clientReference),
    method: "POST",
    body: JSON.stringify({ transactionHash, payerAddress }),
  }).then((payload) => payload.booking);
}

export function createCardPaymentSession({ offerId, holder, guests, stay, acceptedTerms }) {
  return hotelRequest("/card/session", {
    method: "POST",
    body: JSON.stringify({ offerId, holder, guests, stay, acceptedTerms }),
  });
}

export function finalizeCardPayment(clientReference) {
  return hotelRequest(`/card/${encodeURIComponent(clientReference)}/finalize`, {
    headers: bookingHeaders(clientReference),
    method: "POST",
  }).then((payload) => payload.booking);
}

export async function getTravelReservation(reference, signal) {
  const response = await fetch(`${apiBaseUrl}/api/reservations/${encodeURIComponent(reference)}`, { signal, headers: { ...bookingHeaders(reference), ...(getCustomerAccessToken() ? { Authorization: `Bearer ${getCustomerAccessToken()}` } : {}) } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || 'Rezervasyon yüklenemedi.');
  return payload.booking;
}
