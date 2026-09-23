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

export function listHotels({ countryCode = "TR", cityName, limit = 20 }) {
  const query = new URLSearchParams({
    countryCode,
    cityName,
    limit: String(limit),
  });

  return hotelRequest(`?${query.toString()}`, {
    method: "GET",
  });
}

export function searchHotelRates({
  hotelIds,
  checkin,
  checkout,
  adults,
  currency = "EUR",
  guestNationality = "TR",
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
      maxRatesPerHotel: 3,
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
