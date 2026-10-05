import { getCustomerAccessToken } from "./customerApi";
import { bookingHeaders, storeBookingAccess } from "./hotelsApi";
const base = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export async function flightRequest(path, { body, signal, reference } = {}) {
  const response = await fetch(`${base}/api/flights${path}`, {
    method: body ? 'POST' : 'GET', signal,
    headers: { 'Content-Type': 'application/json', ...(getCustomerAccessToken() ? { Authorization: `Bearer ${getCustomerAccessToken()}` } : {}), ...(reference ? bookingHeaders(reference) : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) { const error = new Error(payload.message || payload.code || 'FLIGHT_UNAVAILABLE'); error.code = payload.code; error.payload = payload; throw error; }
  storeBookingAccess(payload.booking?.clientReference, payload.accessToken);
  return payload;
}
