import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';

test('global search resolves countries and cities and preserves pagination boundaries', async () => {
  const realFetch = globalThis.fetch;
  const previousKey = process.env.NUITEE_API_KEY;
  process.env.NUITEE_API_KEY = 'sand_test';
  const upstream = [];
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    if (url.hostname !== 'api.liteapi.travel') return realFetch(input, options);
    upstream.push(url);
    if (url.pathname.endsWith('/countries')) return Response.json({ data: [{ code: 'TR', name: 'Turkey' }, { code: 'DE', name: 'Germany' }, { code: 'TH', name: 'Thailand' }] });
    if (url.pathname.endsWith('/places')) {
      if (url.searchParams.get('textQuery') === 'NotARealDestination') return Response.json({ data: [] });
      return Response.json({ data: [{ placeId: 'dubai-place', displayName: 'Dubai' }] });
    }
    if (url.pathname.endsWith('/hotels')) return Response.json({ data: [{ id: 'hotel-1' }], hotelIds: ['hotel-1'], total: 50 });
    throw new Error(`Unexpected upstream path ${url.pathname}`);
  };
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/hotels`;
  try {
    for (const [name, code] of [['Almanya', 'DE'], ['Tayland', 'TH'], ['Türkiye', 'TR']]) {
      const response = await realFetch(`${base}?destination=${encodeURIComponent(name)}`);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).location, { countryCode: code });
      const query = upstream.at(-1).searchParams;
      assert.equal(query.get('countryCode'), code);
      assert.equal(query.has('cityName'), false);
    }
    const city = await realFetch(`${base}?destination=Dubai`);
    assert.deepEqual((await city.json()).location, { placeId: 'dubai-place' });
    assert.equal(upstream.at(-1).searchParams.get('placeId'), 'dubai-place');
    assert.equal(upstream.at(-1).searchParams.has('countryCode'), false);
    const more = await realFetch(`${base}?placeId=dubai-place&offset=20&limit=20`);
    assert.equal(more.status, 200);
    assert.equal(upstream.at(-1).searchParams.get('offset'), '20');
    assert.equal(upstream.at(-1).searchParams.get('placeId'), 'dubai-place');
    const before = upstream.filter((url) => url.pathname.endsWith('/hotels')).length;
    const missing = await realFetch(`${base}?destination=NotARealDestination`);
    assert.equal(missing.status, 400);
    assert.equal(upstream.filter((url) => url.pathname.endsWith('/hotels')).length, before);
    const legacy = await realFetch(`${base}?countryCode=TR&cityName=Antalya`);
    assert.equal(legacy.status, 200);
    assert.equal(upstream.at(-1).searchParams.get('cityName'), 'Antalya');
  } finally {
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.NUITEE_API_KEY;
    else process.env.NUITEE_API_KEY = previousKey;
    await new Promise((resolve) => server.close(resolve));
  }
});
