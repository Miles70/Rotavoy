// Checkout selection is informational only. Provider offers remain authoritative
// for booking execution, price and payment verification.
export function bookingStay(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const text = (key, max) => typeof source[key] === 'string' ? source[key].trim().slice(0, max) : '';
  const day = key => { const value = text(key, 10); const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) : NaN; return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : ''; };
  const adults = Number(source.adults);
  return { hotelId: text('hotelId', 120), hotelName: text('hotelName', 200), checkin: day('checkin'), checkout: day('checkout'), adults: Number.isInteger(adults) && adults >= 1 && adults <= 8 ? adults : null };
}
