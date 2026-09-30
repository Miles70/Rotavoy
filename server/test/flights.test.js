import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { validateFlightSearch } from '../src/services/flightSearch.js';
import { airportResults, flightResults, flightLocalTime, flightStops } from '../../src/services/flightResults.js';
import flightTranslations from '../../src/i18n/flightTranslations.js';

const search = { origin: 'AYT', destination: 'DXB', departure: '2099-10-01', returnDate: '2099-10-08', adults: 2, children: 1, infants: 1, currency: 'USD' };
const segment = { originCode: 'AYT', destinationCode: 'DXB', departureTime: '2099-10-01T19:30:00', arrivalTime: '2099-10-02T01:00:00', direction: 'OUTBOUND', stopCount: 0 };
const offer = (id, total, currency = 'USD') => ({ offerId: id, pricing: { display: { total, currency } }, baggage: { included: [{ description: '1 carry-on bag up to 8 kg' }] } });
const payload = { data: [{ journeys: [{ journeyKey: 'a', segments: [segment], offers: [offer('expensive', 800), offer('cheap', 400), offer('invalid', null), offer('wrong-currency', 200, 'EUR')] }] }, { journeys: [{ journeyKey: 'b', segments: [segment, { ...segment, direction: 'INBOUND' }], offers: [offer('return', 500)] }] }] };

test('flight request constructs ordered legs and never forwards arbitrary parameters', () => {
  const body = validateFlightSearch({ ...search, margin: { rateSearch: -100 } });
  assert.deepEqual(body.legs, [{ origin: 'AYT', destination: 'DXB', date: search.departure, direction: 'OUTBOUND' }, { origin: 'DXB', destination: 'AYT', date: search.returnDate, direction: 'INBOUND' }]);
  assert.equal(body.adults, 2); assert.equal(body.margin, undefined);
  assert.equal(validateFlightSearch({ ...search, returnDate: undefined }).legs.length, 1);
  for (const changes of [{ origin: 'Antalya' }, { destination: 'AYT' }, { departure: '2099-02-30' }, { departure: '2000-01-01' }, { returnDate: '2099-09-01' }, { adults: 0 }, { adults: 1.5 }, { children: -1 }, { infants: 3 }, { adults: 9 }, { cabinClass: 'FAKE' }, { currency: 'FAKE' }]) {
    assert.throws(() => validateFlightSearch({ ...search, ...changes }), { code: 'INVALID_SEARCH' });
  }
});
test('provider batches preserve complete itineraries, total prices and baggage', () => {
  const results = flightResults(payload, 'USD');
  assert.deepEqual(results.map((item) => item.total), [400, 500, 800]);
  assert.equal(results[1].segments[1].direction, 'INBOUND');
  assert.equal(results[0].offer.baggage.included[0].description, '1 carry-on bag up to 8 kg');
  assert.equal(flightLocalTime(segment.departureTime), '2099-10-01 19:30');
  assert.equal(flightStops([segment]), 0);
  assert.equal(flightStops([segment, { ...segment, stopCount: 1 }]), 2);
  assert.throws(() => flightResults({ unexpected: [] }, 'USD'));
  assert.deepEqual(flightResults({ data: [] }, 'USD'), []);
});
test('airport response and all ten language dictionaries are complete', () => {
  assert.deepEqual(airportResults({ data: [{ airports: [{ iata: 'AYT', city: 'Antalya' }, { iata: null }] }] }), [{ iata: 'AYT', city: 'Antalya' }]);
  assert.equal(Object.keys(flightTranslations).length, 10);
  for (const dictionary of Object.values(flightTranslations)) {
    assert.deepEqual(Object.keys(dictionary), Object.keys(flightTranslations.en));
    assert.ok(Object.values(dictionary).every((value) => typeof value === 'string' && value.length));
  }
});
test('flight HTTP flow uses server credentials, validates before upstream and propagates errors', async () => {
  const realFetch = globalThis.fetch;
  const previousKey = process.env.NUITEE_API_KEY;
  process.env.NUITEE_API_KEY = 'sand_test_fixture_only';
  let calls = []; let failure = false;
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    if (url.hostname !== 'api.liteapi.travel') return realFetch(input, options);
    calls.push({ url, options });
    if (failure) return new Response(JSON.stringify({ error: { message: 'No access' } }), { status: 403 });
    return new Response(JSON.stringify(url.pathname.endsWith('/airports') ? { data: [{ airports: [{ iata: 'AYT', city: 'Antalya' }] }] } : payload));
  };
  const server = createApp().listen(0); await once(server, 'listening');
  const base = `http://localhost:${server.address().port}/api/flights`;
  try {
    const airports = await realFetch(`${base}/airports?q=Antalya`);
    assert.equal(airports.status, 200); assert.equal(airportResults(await airports.json())[0].iata, 'AYT');
    assert.equal(calls[0].url.searchParams.get('q'), 'Antalya');
    const request = (body) => realFetch(`${base}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await request(search);
    assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'private, no-store');
    const data = await result.json(); assert.equal(data.environment, 'sandbox'); assert.equal(flightResults(data, 'USD').length, 3);
    assert.equal(calls[1].url.pathname, '/v3.0/flights/rates');
    assert.equal(calls[1].options.headers['X-API-Key'], 'sand_test_fixture_only');
    assert.equal(JSON.parse(calls[1].options.body).legs.length, 2);
    const before = calls.length;
    assert.equal((await request({ ...search, adults: 0 })).status, 400); assert.equal(calls.length, before);
    failure = true;
    assert.deepEqual(await (await request(search)).json(), { code: 'FLIGHT_UNAVAILABLE' });
  } finally {
    await new Promise((resolve) => server.close(resolve)); globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.NUITEE_API_KEY; else process.env.NUITEE_API_KEY = previousKey;
  }
});
