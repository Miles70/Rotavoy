import assert from 'node:assert/strict';
import test from 'node:test';
import { getBookingAvailability } from '../src/config/bookingAvailability.js';
import { assertConfirmedBooking } from '../src/services/bookingConfirmation.js';
import { createApp } from '../src/app.js';
import { TravelBooking } from '../src/models/TravelBooking.js';

const sandbox = { NUITEE_API_KEY: 'sand_fixture', NODE_ENV: 'development' };

test('local and explicitly staged sandbox card tests stay available', () => {
  for (const env of [sandbox, { ...sandbox, NODE_ENV: 'production', ROTAVOY_ENV: 'staging' }]) {
    assert.equal(getBookingAvailability(env).cardBookingEnabled, true);
    assert.equal(getBookingAvailability(env).cryptoBookingEnabled, false);
    assert.equal(getBookingAvailability({ ...env, NUITEE_ENABLE_SANDBOX_BOOKING: 'true' }).cryptoBookingEnabled, true);
  }
});

test('production rejects sandbox even when both booking flags are enabled', () => {
  const status = getBookingAvailability({ ...sandbox, NODE_ENV: 'production', NUITEE_ENABLE_SANDBOX_BOOKING: 'true', NUITEE_ENABLE_LIVE_BOOKING: 'true' });
  assert.equal(status.providerAllowed, false);
  assert.equal(status.cardBookingEnabled, false);
  assert.equal(status.cryptoBookingEnabled, false);
});

test('live card bookings require opt-in; incomplete live crypto cannot collect funds', () => {
  const env = { NODE_ENV: 'production', NUITEE_API_KEY: 'live_fixture' };
  assert.equal(getBookingAvailability(env).cardBookingEnabled, false);
  assert.equal(getBookingAvailability({ ...env, NUITEE_ENABLE_LIVE_BOOKING: 'true' }).cardBookingEnabled, true);
  assert.equal(getBookingAvailability({ ...env, NUITEE_ENABLE_LIVE_BOOKING: 'true', NUITEE_ENABLE_SANDBOX_BOOKING: 'true' }).cryptoBookingEnabled, false);
  assert.equal(getBookingAvailability({ ...env, ROTAVOY_ENV: 'staging' }).providerAllowed, false);
  assert.equal(getBookingAvailability({}).cardBookingEnabled, false);
});

test('only explicit supplier confirmation can become a successful reservation', () => {
  for (const payload of [{}, { data: {} }, { data: { bookingId: 'id', status: 'PENDING' } }, { error: { message: 'declined' }, data: { bookingId: 'id', status: 'CONFIRMED' } }]) {
    assert.throws(() => assertConfirmedBooking(payload), { statusCode: 502 });
  }
  assert.equal(assertConfirmedBooking({ data: { bookingId: 'id', status: 'CONFIRMED' } }).bookingId, 'id');
});

async function withServer(run) {
  const server = createApp().listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

function setEnvironment(t, values) {
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

test('closed checkout routes reject before any database or provider action', async t => {
  setEnvironment(t, { NODE_ENV: 'production', ROTAVOY_ENV: 'production', NUITEE_API_KEY: 'sand_fixture', NUITEE_ENABLE_LIVE_BOOKING: 'true' });
  t.mock.method(TravelBooking, 'create', () => { throw new Error('Database must not be used'); });
  await withServer(async base => {
    for (const path of ['/api/hotels/card/session', '/api/hotels/crypto-checkout', '/api/hotels/checkout']) {
      const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 503);
    }
    const status = await fetch(base + '/api/hotels/status');
    assert.equal(status.headers.get('cache-control'), 'no-store');
    assert.equal((await status.json()).cardBookingEnabled, false);
  });
});

test('concurrent card callbacks finalize once; ambiguous failure stays pending', async t => {
  setEnvironment(t, { NODE_ENV: 'development', ROTAVOY_ENV: 'development', NUITEE_API_KEY: 'sand_fixture' });
  let claimed = false;
  let supplierCalls = 0;
  let fail = false;
  const booking = {
    _id: 'booking', clientReference: 'TRV-CARD-fixture', status: 'awaiting_payment',
    paymentStatus: 'pending', payment: { method: 'card', transactionId: 'transaction' },
    prebookId: 'prebook', total: 120, currency: 'USD',
    holder: { firstName: 'Test', lastName: 'Guest', email: 'test@example.com' },
    guests: [{ firstName: 'Test', lastName: 'Guest', email: 'test@example.com', occupancyNumber: 1 }],
    async save() { return this; },
  };
  t.mock.method(TravelBooking, 'findOne', async () => booking);
  t.mock.method(TravelBooking, 'findOneAndUpdate', async (filter) => {
    assert.equal(filter.status, 'awaiting_payment');
    if (claimed) return null;
    claimed = true;
    booking.status = 'processing';
    return booking;
  });
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!String(url).includes('book.liteapi.travel')) return originalFetch(url, options);
    supplierCalls++;
    assert.equal(JSON.parse(options.body).payment.transactionId, 'transaction');
    await new Promise(resolve => setTimeout(resolve, 25));
    if (fail) throw new Error('Connection lost after submitting booking');
    return new Response(JSON.stringify({ data: { bookingId: 'supplier-id', status: 'CONFIRMED' } }), { status: 200 });
  });
  await withServer(async base => {
    const finalize = () => fetch(base + '/api/hotels/card/TRV-CARD-fixture/finalize', { method: 'POST' });
    const results = await Promise.all([finalize(), finalize()]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 202]);
    assert.equal(supplierCalls, 1);
    assert.equal(booking.status, 'confirmed');
    assert.equal((await finalize()).status, 200);
    assert.equal(supplierCalls, 1);
    booking.status = 'awaiting_payment';
    booking.paymentStatus = 'pending';
    claimed = false;
    fail = true;
    assert.equal((await finalize()).status, 502);
    assert.equal(booking.status, 'processing');
    assert.equal(booking.paymentStatus, 'pending');
    assert.equal((await finalize()).status, 202);
    assert.equal(supplierCalls, 2);
  });
});
