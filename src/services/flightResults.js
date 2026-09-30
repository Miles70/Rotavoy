export function airportResults(payload) {
  return (payload?.data || []).flatMap((batch) => batch.airports || [])
    .filter((airport) => /^[A-Z]{3}$/.test(airport.iata));
}
export function flightResults(payload, currency) {
  if (!Array.isArray(payload?.data) || payload.data.some((batch) => !Array.isArray(batch.journeys))) throw new Error('FLIGHT_UNAVAILABLE');
  const results = new Map();
  for (const batch of payload.data) {
    for (const journey of batch.journeys) {
      if (!journey.segments?.length) continue;
      for (const offer of journey.offers || []) {
        const price = offer.pricing?.display;
        if (!offer.offerId || price?.total == null || !Number.isFinite(Number(price.total)) || Number(price.total) <= 0 || price.currency !== currency) continue;
        results.set(offer.offerId, { ...journey, offer, total: Number(price.total), currency: price.currency });
      }
    }
  }
  return [...results.values()].sort((a, b) => a.total - b.total);
}
// Provider timestamps are airport-local. Do not convert them to the viewer's timezone.
export function flightLocalTime(value) {
  return typeof value === 'string' ? value.replace('T', ' ').slice(0, 16) : '—';
}
export function flightStops(segments) {
  return Math.max(0, segments.length - 1) + segments.reduce((sum, segment) => sum + (Number(segment.stopCount) || 0), 0);
}
