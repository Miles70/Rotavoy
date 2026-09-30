import assert from 'node:assert/strict';
import test from 'node:test';
import { getCurrentCoordinates } from '../../src/services/geolocation.js';

test('device coordinates are returned unchanged with accuracy and timeout options', async () => {
  let requestedOptions;
  const coordinates = await getCurrentCoordinates({ getCurrentPosition(success, _failure, options) {
    requestedOptions = options;
    success({ coords: { latitude: 36.923456, longitude: 30.712345 } });
  } });
  assert.deepEqual(coordinates, { latitude: 36.923456, longitude: 30.712345 });
  assert.equal(requestedOptions.enableHighAccuracy, true);
  assert.equal(requestedOptions.timeout, 20000);
});

test('denied permission and timeout propagate without fabricated location', async () => {
  for (const code of [1, 2, 3]) {
    await assert.rejects(getCurrentCoordinates({ getCurrentPosition(_success, failure) {
      failure({ code });
    } }), (error) => error.code === code);
  }
  await assert.rejects(getCurrentCoordinates(null), /unavailable/);
});
