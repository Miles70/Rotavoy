import test from 'node:test';
import assert from 'node:assert/strict';
import { rateTerms, changedTerms, mergeTerms, guardRateTerms } from '../../shared/hotelRate.js';
// Shapes and values captured from the production /hotels/rates and /prebook responses.
const rate = { name: '2 Twin Beds', adultCount: 2, childCount: 0, boardType: 'RO', boardName: 'Room Only', retailRate: { taxesAndFees: [{ included: true, description: 'OTHERS', amount: 70.23, currency: 'USD' }] }, cancellationPolicies: { cancelPolicyInfos: [], hotelRemarks: [], refundableTag: 'NRFN' }, remarks: '' };
const offer = { suggestedSellingPrice: { amount: 458.26, currency: 'USD' }, rates: [rate], rateType: 'package', supplierId: 'private' };
const prebook = { price: 458.26, currency: 'USD', roomTypes: [{ rates: [rate] }] };
test('real rates and prebook shapes map identically without internal commercial fields or duplicate markup', () => {
  assert.deepEqual(rateTerms(offer), rateTerms(prebook, true));
  assert.equal(rateTerms(offer).total, 458.26);
  assert.equal(rateTerms(offer).rooms[0].meal, 'RO');
  assert.equal(rateTerms(offer).rooms[0].cancellation.refundableTag, 'NRFN');
  assert.equal(JSON.stringify(rateTerms(offer)).includes('package'), false);
  assert.equal(rateTerms({}).total, null);
  assert.deepEqual(rateTerms({}).rooms, []);
});
test('price, currency, board, penalty, deadline, refundability and excluded tax changes require review', () => {
  const original = rateTerms(offer);
  for (const patch of [{ total: 459 }, { currency: 'EUR' }]) assert.deepEqual(changedTerms(original, { ...original, ...patch }), ['Toplam fiyat']);
  for (const cancellation of [{ ...rate.cancellationPolicies, refundableTag: 'RFN' }, { ...rate.cancellationPolicies, cancelPolicyInfos: [{ cancelTime: '2026-10-15 10:00:00', amount: 247.34, currency: 'USD', type: 'amount', timezone: 'GMT' }] }]) assert.deepEqual(changedTerms(original, { ...original, rooms: [{ ...original.rooms[0], cancellation }] }), ['İptal koşulları']);
  assert.deepEqual(changedTerms(original, { ...original, rooms: [{ ...original.rooms[0], meal: 'BB' }] }), ['Yemek planı']);
  assert.deepEqual(changedTerms(original, { ...original, rooms: [{ ...original.rooms[0], taxes: [{ included: false, amount: 10, currency: 'USD' }] }] }), ['Vergi ve ücretler']);
});
test('missing prebook facts stay unknown and do not fabricate removed terms', () => {
  const confirmed = rateTerms({ price: 458.26, currency: 'USD' }, true);
  assert.deepEqual(changedTerms(rateTerms(offer), confirmed), []);
  assert.deepEqual(mergeTerms(rateTerms(offer), confirmed).rooms, rateTerms(offer).rooms);
});
test('checkout guard rejects missing or stale acceptance before issuing payment, then accepts confirmed terms', () => {
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  assert.equal(guardRateTerms(response, undefined, prebook), false);
  assert.equal(response.code, 409);
  assert.equal(guardRateTerms(response, { ...rateTerms(offer), total: 400 }, prebook), false);
  assert.equal(response.body.code, 'RATE_CHANGED');
  assert.equal(guardRateTerms(response, response.body.confirmedTerms, prebook), true);
});

test('explicit provider change flags cannot pass silently and acceptance can proceed without an endless loop', () => {
  const before = rateTerms(offer), after = rateTerms({ ...prebook, boardChanged: true, cancellationChanged: true }, true);
  assert.deepEqual(changedTerms(before, after), ['Yemek planı', 'İptal koşulları']);
  assert.deepEqual(changedTerms(mergeTerms(before, after), after), []);
});
