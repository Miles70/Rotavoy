import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, withHotelDistances } from '../../src/services/hotelDistance.js';

test('distance uses great-circle kilometers and accepts zero coordinates', () => {
  assert.equal(distanceKm({latitude:0,longitude:0}, {latitude:0,longitude:0}), 0);
  assert.ok(Math.abs(distanceKm({latitude:0,longitude:0}, {latitude:0,longitude:1}) - 111.195) < .01);
  assert.equal(distanceKm({}, {latitude:0,longitude:1}), null);
  assert.equal(distanceKm({latitude:null,longitude:0}, {latitude:0,longitude:1}), null);
});
test('catalog coordinates match hotel IDs, while missing positions stay unavailable', () => {
  const result = withHotelDistances([{hotelId:'b'}, {hotelId:'a'}, {hotelId:'c'}], {data:[{id:'a',latitude:0,longitude:0},{id:'b',latitude:0,longitude:1}]}, {latitude:0,longitude:0});
  assert.ok(result[0].distanceKm > 111);
  assert.equal(result[1].distanceKm,0);
  assert.equal(result[2].distanceKm,null);
  assert.equal(withHotelDistances([{hotelId:'a'}],{data:[]},{destination:'Dubai'})[0].distanceKm,null);
});
