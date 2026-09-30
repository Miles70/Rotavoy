const base = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export async function flightRequest(path, { body, signal } = {}) {
  const response = await fetch(`${base}/api/flights${path}`, {
    method: body ? 'POST' : 'GET', signal,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.code || 'FLIGHT_UNAVAILABLE');
  return payload;
}
