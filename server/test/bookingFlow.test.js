import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { TravelBooking } from '../src/models/TravelBooking.js';
import { createBookingAccess, requireBookingAccess } from '../src/services/bookingAccess.js';
import { finalizeBooking } from '../src/services/finalizeBooking.js';
import { assertBookingReady } from '../src/services/nuiteeApi.js';
import { validateFlightPassengers } from '../src/services/flightPassengers.js';
import { publicReservation } from '../src/services/bookingState.js';
const contact = { firstName: 'Selim', lastName: 'Yalcin', email: 'customer@example.com', phoneCountryCode: '90', phoneNumber: '5551234567' };
const passenger = { firstName: 'Selim', lastName: 'Yalcin', birthday: '1990-01-01', gender: 'M', nationality: 'TR', documentType: 'passport', documentNumber: 'U123456', documentIssueCountry: 'TR', documentExpiry: '2099-01-01', passengerType: 0 };
const journey = { passengers: { adults: 1, children: 0, infants: 0 }, segments: [{ direction: 'OUTBOUND', originCode: 'AYT', destinationCode: 'FRA', departureTime: '2027-01-01T08:00:00', arrivalTime: '2027-01-01T11:00:00' }], pricing: { display: { total: 175, currency: 'USD' } } };
test('passengers match verified counts, age categories and document validity', () => {
  assert.equal(validateFlightPassengers({ contact, passengers: [passenger] }, journey).passengers[0].passengerType, 0);
  for (const changes of [{ birthday: '2026-01-01' }, { documentExpiry: '2026-01-01' }, { nationality: 'Turkey' }]) assert.throws(() => validateFlightPassengers({ contact, passengers: [{ ...passenger, ...changes }] }, journey));
  assert.throws(() => validateFlightPassengers({ contact, passengers: [passenger, passenger] }, journey));
});
test('guest reservation capability and authenticated ownership protect payment records', () => {
  const access = createBookingAccess(); const booking = { accessTokenHash: access.hash, customerId: 'alice' };
  requireBookingAccess({ headers: { 'x-booking-token': access.token } }, booking);
  requireBookingAccess({ headers: {}, customer: { _id: 'alice' } }, booking);
  assert.throws(() => requireBookingAccess({ headers: {}, customer: { _id: 'bob' } }, booking), { statusCode: 403 });
  assert.throws(() => requireBookingAccess({ headers: { 'x-booking-token': 'wrong' } }, booking), { statusCode: 403 });
  assert.equal(publicReservation({ data: { bookingId: 'id', status: 'CONFIRMED', transactionId: 'secret' } }).transactionId, undefined);
});
test('HTTP hotel and flight payment sessions finalize only on provider confirmation, reject strangers and reconcile without duplicate booking', async () => {
  const originalFetch = globalThis.fetch, oldEnv = { ...process.env };
  const originals = Object.fromEntries(['create', 'findOne', 'findOneAndUpdate', 'findById'].map(k => [k, TravelBooking[k]]));
  process.env.NUITEE_API_KEY = 'production_fixture_only'; process.env.NUITEE_ENABLE_LIVE_BOOKING = 'true';
  const records = new Map(); let providerPosts = 0, mode = 'confirmed';
  const providerResult = () => ({ bookingId: 'provider-id', status: mode === 'confirmed' ? 'CONFIRMED' : 'PENDING_CONFIRMATION', clientReference: [...records.values()].at(-1)?.clientReference, hotelConfirmationCode: 'HTL-123', bookingRef: 'PNR-ABC' });
  TravelBooking.create = async value => { const b = { _id: String(records.size), kind: 'hotel', status: 'awaiting_payment', bookingAttemptAt: null, ...value, async save() { return this; } }; records.set(b.clientReference, b); return b; };
  TravelBooking.findOne = async q => records.get(q.clientReference) || null;
  TravelBooking.findById = async id => [...records.values()].find(b => b._id === id);
  TravelBooking.findOneAndUpdate = async (q, update) => { const b = await TravelBooking.findById(q._id); if (b.bookingAttemptAt || !q.status.$in.includes(b.status)) return null; Object.assign(b, update.$set); return b; };
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    if (!url.hostname.endsWith('liteapi.travel')) return originalFetch(input, options);
    if (url.pathname.endsWith('/verify')) return Response.json({ data: [{ journey }] });
    if (url.pathname.endsWith('/prebooks')) return Response.json({ data: [{ prebookId: 'prebook-flight', transactionId: 'tx-flight', secretKey: 'pi_fixture_secret_fixture', publishableKey: 'pk_live_fixture', price: 175, currency: 'USD', booking: { bookingId: 'provider-id' } }] });
    if (url.pathname.endsWith('/prebook')) { assert.equal(JSON.parse(options.body).usePaymentSdk, true); return Response.json({ data: { prebookId: 'prebook-hotel', transactionId: 'tx-hotel', secretKey: 'secret', price: 175, currency: 'USD' } }); }
    if (options?.method === 'POST') { providerPosts++; assert.equal(JSON.parse(options.body).payment.method, 'TRANSACTION_ID'); return Response.json({ data: url.hostname === 'book.liteapi.travel' ? providerResult() : [providerResult()] }); }
    return Response.json({ data: [providerResult()] });
  };
  const server = createApp().listen(0); await once(server, 'listening'); const base = `http://localhost:${server.address().port}/api`;
  const request = (path, body, token) => originalFetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Booking-Token': token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    const staleSession = await request('/hotels/card/session', { offerId: 'offer', acceptedTerms: { total: 100, currency: 'USD', rooms: [] }, holder: contact, guests: [{ ...contact, occupancyNumber: 1 }] });
    assert.equal(staleSession.status, 409);
    assert.equal((await staleSession.json()).code, 'RATE_CHANGED');
    assert.equal(records.size, 0, 'stale terms must not create a payable booking');
    const session = await request('/hotels/card/session', { offerId: 'offer', acceptedTerms: { total: 175, currency: 'USD', rooms: [] }, holder: contact, guests: [{ ...contact, occupancyNumber: 1 }] });
    assert.equal(session.status, 201); const hotel = await session.json(); const ref = hotel.booking.clientReference;
    assert.equal((await request(`/hotels/card/${ref}/finalize`, {})).status, 403);
    mode = 'pending';
    const results = await Promise.all([request(`/hotels/card/${ref}/finalize`, {}, hotel.accessToken), request(`/hotels/card/${ref}/finalize`, {}, hotel.accessToken)]);
    for (const r of results) assert.equal((await r.json()).booking.status, 'processing');
    assert.equal(providerPosts, 1);
    mode = 'confirmed'; const status = await request(`/reservations/${ref}`, null, hotel.accessToken);
    assert.equal((await status.json()).booking.reservation.hotelConfirmationCode, 'HTL-123'); assert.equal(providerPosts, 1);
    const priceChange = await request('/flights/checkout', { offerId: 'flight', contact, passengers: [passenger], acceptedTotal: 100, acceptedCurrency: 'USD' });
    assert.equal(priceChange.status, 409); assert.equal((await priceChange.json()).code, 'PRICE_CHANGED');
    const flightResponse = await request('/flights/checkout', { offerId: 'flight', contact, passengers: [passenger], acceptedTotal: 175, acceptedCurrency: 'USD' });
    assert.equal(flightResponse.status, 201); const flight = await flightResponse.json();
    assert.equal(flight.booking.kind, 'flight'); assert.equal(flight.paymentSession.publishableKey, 'pk_live_fixture');
    assert.equal((await request(`/flights/${flight.booking.clientReference}/finalize`, {})).status, 403);
    const confirmed = await request(`/flights/${flight.booking.clientReference}/finalize`, {}, flight.accessToken);
    assert.equal((await confirmed.json()).booking.status, 'confirmed'); assert.equal(providerPosts, 2);
    await request(`/flights/${flight.booking.clientReference}/finalize`, {}, flight.accessToken); assert.equal(providerPosts, 2);
    process.env.NUITEE_API_KEY = 'sand_fixture'; assert.throws(() => assertBookingReady('account'), { statusCode: 503 });
    process.env.NODE_ENV = 'production'; assert.throws(() => assertBookingReady(), { statusCode: 503 });
  } finally { await new Promise(r => server.close(r)); globalThis.fetch = originalFetch; Object.assign(TravelBooking, originals); for (const k of Object.keys(process.env)) if (!(k in oldEnv)) delete process.env[k]; Object.assign(process.env, oldEnv); }
});
test('unknown provider result remains processing and is never replayed', async () => {
  const originals = { fetch: globalThis.fetch, update: TravelBooking.findOneAndUpdate }; const oldKey = process.env.NUITEE_API_KEY, oldFlag = process.env.NUITEE_ENABLE_LIVE_BOOKING;
  process.env.NUITEE_API_KEY = 'production_fixture'; process.env.NUITEE_ENABLE_LIVE_BOOKING = 'true';
  const b = { _id: 'test', kind: 'hotel', status: 'processing', payment: { method: 'card', transactionId: 'tx' }, holder: contact, guests: [], async save() {} };
  TravelBooking.findOneAndUpdate = async () => { b.bookingAttemptAt = new Date(); return b; };
  let posts = 0; globalThis.fetch = async (_url, options) => { if (options.method === 'POST') { posts++; throw new Error('connection lost'); } return Response.json({ data: [] }); };
  try { assert.equal((await finalizeBooking(b)).status, 'processing'); await finalizeBooking(b); assert.equal(posts, 1); }
  finally { globalThis.fetch = originals.fetch; TravelBooking.findOneAndUpdate = originals.update; if (oldKey === undefined) delete process.env.NUITEE_API_KEY; else process.env.NUITEE_API_KEY = oldKey; if (oldFlag === undefined) delete process.env.NUITEE_ENABLE_LIVE_BOOKING; else process.env.NUITEE_ENABLE_LIVE_BOOKING = oldFlag; }
});
