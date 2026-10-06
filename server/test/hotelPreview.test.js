import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listNuiteeHotels, listNuiteeCountries, searchNuiteePlaces, getNuiteeHotel,
  searchNuiteeRates, prebookNuiteeRate, bookNuiteeSandbox, assertBookingReady,
} from '../src/services/nuiteeApi.js';

test('production sandbox hotel previews work while prebooks and bookings remain blocked', async () => {
  const keys = ['NODE_ENV', 'NUITEE_API_KEY', 'NUITEE_ENABLE_SANDBOX_BOOKING'];
  const previous = keys.map(key => process.env[key]);
  const realFetch = globalThis.fetch;
  const requests = [];
  process.env.NODE_ENV = 'production';
  process.env.NUITEE_API_KEY = 'sand_preview_fixture';
  process.env.NUITEE_ENABLE_SANDBOX_BOOKING = 'true';
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return Response.json({ data: [{ id: 'hotel-1' }] });
  };
  try {
    for (const read of [
      () => listNuiteeHotels({ countryCode: 'TR', cityName: 'Antalya' }),
      listNuiteeCountries, () => searchNuiteePlaces('Antalya'),
      () => getNuiteeHotel('hotel-1'),
      () => searchNuiteeRates({ hotelIds: ['hotel-1'] }),
    ]) assert.deepEqual((await read()).data, [{ id: 'hotel-1' }]);
    assert.equal(requests.length, 5);
    assert.equal(requests.at(-1).options.method, 'POST');
    await assert.rejects(prebookNuiteeRate({ offerId: 'offer-1' }), { statusCode: 503 });
    await assert.rejects(bookNuiteeSandbox({}), { statusCode: 503 });
    assert.throws(() => assertBookingReady(), { statusCode: 503 });
    assert.equal(requests.length, 5);
    process.env.NUITEE_API_KEY = 'production_fixture';
    await prebookNuiteeRate({ offerId: 'offer-1' });
    assert.equal(requests.length, 6);
    delete process.env.NUITEE_API_KEY;
    await assert.rejects(listNuiteeHotels({}), { statusCode: 503 });
    assert.equal(requests.length, 6);
  } finally {
    globalThis.fetch = realFetch;
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});
