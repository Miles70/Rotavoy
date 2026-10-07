import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOfferConditions, normalizePrebookTerms, publicPrebook, termChanges, requireAcceptedTerms } from '../src/services/hotelRateConditions.js';
// Shapes and values captured from production rates/prebook; existing regression cases retained.
const rate = { name: '2 Twin Beds', adultCount: 2, childCount: 0, boardType: 'RO', boardName: 'Room Only', retailRate: { taxesAndFees: [{ included: true, description: 'OTHERS', amount: 70.23, currency: 'USD' }] }, cancellationPolicies: { cancelPolicyInfos: [], hotelRemarks: [], refundableTag: 'NRFN' }, remarks: '' };
const offer = { suggestedSellingPrice: { amount: 458.26, currency: 'USD' }, rates: [rate], rateType: 'package', supplierId: 'private' };
const prebook = { price: 458.26, currency: 'USD', roomTypes: [{ rates: [rate] }] };
test('real rates and prebook map identically without internal commercial fields or duplicate markup', () => {
  assert.deepEqual(normalizeOfferConditions(offer), normalizePrebookTerms(prebook).conditions);
  const terms = normalizePrebookTerms(prebook);
  assert.equal(terms.total, 458.26);
  assert.equal(terms.conditions.rooms[0].mealPlan, 'roomOnly');
  assert.equal(terms.conditions.rooms[0].refundability, 'nonRefundable');
  assert.equal(JSON.stringify(terms).includes('package'), false);
  assert.equal(normalizePrebookTerms({}).total, null);
  assert.deepEqual(normalizePrebookTerms({}).conditions.rooms, []);
});
test('price, currency, board, penalty, deadline, refundability and excluded tax changes require review', () => {
  const original = normalizePrebookTerms(prebook);
  for (const patch of [{ total: 459 }, { currency: 'EUR' }]) assert.deepEqual(termChanges(original, { ...original, ...patch }), ['price']);
  for (const cancellationPolicies of [{ ...rate.cancellationPolicies, refundableTag: 'RFN' }, { ...rate.cancellationPolicies, cancelPolicyInfos: [{ cancelTime: '2026-10-15 10:00:00', amount: 247.34, currency: 'USD', type: 'amount', timezone: 'GMT' }] }]) assert.deepEqual(termChanges(original, normalizePrebookTerms({ ...prebook, roomTypes: [{ rates: [{ ...rate, cancellationPolicies }] }] })), ['cancellation']);
  assert.deepEqual(termChanges(original, normalizePrebookTerms({ ...prebook, roomTypes: [{ rates: [{ ...rate, boardType: 'BI' }] }] })), ['meal']);
  assert.deepEqual(termChanges(original, normalizePrebookTerms({ ...prebook, roomTypes: [{ rates: [{ ...rate, retailRate: { taxesAndFees: [{ included: false, amount: 10, currency: 'USD' }] } }] }] })), ['charges']);
});
test('missing prebook facts stay unknown and cannot silently inherit an old cancellation promise', () => {
  const confirmed = normalizePrebookTerms({ price: 458.26, currency: 'USD' });
  assert.deepEqual(confirmed.conditions.rooms, []);
  assert.equal(confirmed.bookingConditions, '');
  assert.ok(termChanges(normalizePrebookTerms(prebook), confirmed).includes('cancellation'));
});
test('checkout guard rejects missing or stale acceptance before payment, then accepts current revision', () => {
  const response = { set() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  assert.equal(requireAcceptedTerms({ body: {} }, response, prebook), null);
  assert.equal(response.code, 409);
  assert.equal(requireAcceptedTerms({ body: { acceptedRevision: publicPrebook({ ...prebook, price: 400 }).revision } }, response, prebook), null);
  assert.equal(response.body.code, 'HOTEL_TERMS_CHANGED');
  assert.ok(requireAcceptedTerms({ body: { acceptedRevision: response.body.prebook.revision } }, response, prebook));
});
test('provider change flags are visible while current acceptance avoids an endless review loop', () => {
  const changed = { ...prebook, boardChanged: true, cancellationChanged: true };
  assert.deepEqual(publicPrebook(changed).changes, ['cancellation', 'meal']);
  const response = { set() {}, status() { throw new Error('current terms must be accepted'); } };
  assert.ok(requireAcceptedTerms({ body: { acceptedRevision: publicPrebook(changed).revision } }, response, changed));
});
test('empty extra-fee list and absent fee data remain distinct; neither proves taxes are included', () => {
  const before = normalizePrebookTerms(prebook);
  for (const retailRate of [{ taxesAndFees: [] }, {}]) {
    const after = normalizePrebookTerms({ ...prebook, roomTypes: [{ rates: [{ ...rate, retailRate }] }] });
    assert.deepEqual(termChanges(before, after), ['charges']);
    assert.equal(after.conditions.rooms[0].taxesIncluded, null);
    assert.deepEqual(after.conditions.rooms[0].taxesAndFees, 'taxesAndFees' in retailRate ? [] : null);
  }
});
