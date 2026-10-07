import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { normalizeRateConditions, normalizeOfferConditions, publicPrebook, termChanges, normalizePrebookTerms } from '../src/services/hotelRateConditions.js';
import { cancellationStatus } from '../../shared/hotelCancellation.js';
import { createApp } from '../src/app.js';
import { TravelBooking } from '../src/models/TravelBooking.js';

// Shapes observed through Rotavoy's live Novotel rates/prebook on 2026-10-07.
// Synthetic prices and dates keep assertions independent of live availability.
const rate = () => ({ name: 'Superior Room, 1 King Bed', adultCount: 2, childCount: 0, maxOccupancy: 2,
  boardType: 'RO', boardName: 'Room Only', retailRate: { taxesAndFees: [{ included: false, description: 'Property service charge', amount: 34, currency: 'USD' }, { included: true, description: 'VAT', amount: 22, currency: 'USD' }] },
  cancellationPolicies: { refundableTag: 'RFN', cancelPolicyInfos: [{ cancelTime: '2027-11-04 18:00:00', amount: 184, currency: 'USD', type: 'amount', timezone: 'GMT' }], hotelRemarks: [] },
});
const prebook = () => ({ price: 369, currency: 'USD', roomTypes: [{ rates: [rate()] }], termsAndConditions: '', cancellationChanged: false, boardChanged: false });

test('refund tags, missing policies and price type never invent free cancellation', () => {
  assert.equal(cancellationStatus(normalizeRateConditions({ priceType: 'standard' })).kind, 'unknown');
  assert.equal(cancellationStatus(normalizeRateConditions({ cancellationPolicies: { refundableTag: 'NRFN' } })).kind, 'nonRefundable');
  assert.equal(cancellationStatus(normalizeRateConditions({ cancellationPolicies: { refundableTag: 'RFN', cancelPolicyInfos: [] } })).kind, 'refundable');
  const condition = normalizeRateConditions(rate());
  assert.deepEqual(cancellationStatus(condition, Date.parse('2027-11-04T17:59:59Z')), { kind: 'freeUntil', deadline: '2027-11-04T18:00:00Z' });
  assert.equal(cancellationStatus(condition, Date.parse('2027-11-04T18:00:00Z')).kind, 'penalty');
});
test('zero-amount stages restore free cancellation; unknown policy unit/time is conservative', () => {
  const r = rate(); r.cancellationPolicies.cancelPolicyInfos.unshift({ cancelTime: '2027-11-01 00:00:00', amount: 0, type: 'amount', currency: 'USD' });
  assert.equal(cancellationStatus(normalizeRateConditions(r), Date.parse('2027-11-02T00:00:00Z')).kind, 'freeUntil');
  r.cancellationPolicies.cancelPolicyInfos[1].timezone = 'Bangkok';
  assert.equal(cancellationStatus(normalizeRateConditions(r)).kind, 'refundable');
  r.cancellationPolicies.cancelPolicyInfos[1].timezone = 'GMT'; r.cancellationPolicies.cancelPolicyInfos[1].type = 'nights';
  assert.equal(cancellationStatus(normalizeRateConditions(r)).kind, 'refundable');
});
test('documented meal plans map, unfamiliar BB/code uses readable name or neutral fallback', () => {
  for (const [code, key] of Object.entries({ RO: 'roomOnly', BI: 'breakfast', HB: 'halfBoard', FB: 'fullBoard', AI: 'allInclusive' })) assert.equal(normalizeRateConditions({ boardType: code }).mealPlan, key);
  assert.equal(normalizeRateConditions({ boardType: 'BB' }).mealPlan, 'unknown');
  assert.equal(normalizeRateConditions({ boardType: 'NEW', boardName: 'A new meal plan' }).mealPlanName, 'A new meal plan');
});
test('separate charges retain exact amount/currency; empty or absent taxes never imply all-inclusive', () => {
  const r = rate(); assert.equal(normalizeRateConditions(r).taxesIncluded, false);
  assert.equal(normalizeRateConditions(r).taxesAndFees[0].amount, 34);
  r.retailRate.taxesAndFees[0].included = true; assert.equal(normalizeRateConditions(r).taxesIncluded, true);
  for (const taxesAndFees of [null, [], [{ description: 'Unknown', amount: null }]]) assert.equal(normalizeRateConditions({ retailRate: { taxesAndFees } }).taxesIncluded, null);
});
test('prebook identifies only actual material changes and exposes no commercial fields', () => {
  const source = prebook(); source.commission = 100; source.secretKey = 'secret'; source.supplier = 'internal'; source.roomTypes[0].rates[0].provider_net_price = 120;
  const before = normalizePrebookTerms(source);
  assert.deepEqual(termChanges(before, before), []);
  assert.deepEqual(termChanges(before, { ...before, total: 400 }), ['price']);
  for (const [change, mutate] of [['cancellation', r => { r.cancellationPolicies.refundableTag = 'NRFN'; }], ['meal', r => { r.boardType = 'AI'; }], ['charges', r => { r.retailRate.taxesAndFees[0].amount = 100; }], ['room', r => { r.name = 'Other room'; }]]) {
    const next = prebook(); mutate(next.roomTypes[0].rates[0]); assert.deepEqual(termChanges(before, normalizePrebookTerms(next)), [change]);
  }
  assert.deepEqual(termChanges(undefined, before, { cancellationChanged: true, boardChanged: true, priceDifferencePercent: 1 }), ['price', 'cancellation', 'meal']);
  const exposed = JSON.stringify(publicPrebook(source));
  for (const secret of ['secretKey', 'commission', 'supplier', 'provider_net_price', 'retailRate', 'rateId']) assert.ok(!exposed.includes(secret));
  assert.equal(normalizeRateConditions({ name: 'Long room name '.repeat(100) }).roomName, 'Long room name '.repeat(100).trim());
  assert.deepEqual(normalizeOfferConditions({}).rooms, []);
});
test('HTTP rates/prebook retain public conditions; ALL hotel checkout routes require current consent before payment record creation', async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.NUITEE_API_KEY, oldCreate = TravelBooking.create;
  process.env.NUITEE_API_KEY = 'production_fixture_only';
  let total = 369, created = 0;
  TravelBooking.create = async () => { created++; throw new Error('must not create payment before consent'); };
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    if (!url.hostname.endsWith('liteapi.travel')) return oldFetch(input, options);
    if (url.pathname.endsWith('/rates')) return Response.json({ data: [{ hotelId: 'hotel', roomTypes: [{ offerId: 'offer', offerRetailRate: { amount: total, currency: 'USD' }, rates: [rate()], supplierId: 'private', commission: 99 }] }], hotels: [] });
    return Response.json({ data: { ...prebook(), price: total, prebookId: 'prebook', secretKey: 'secret', transactionId: 'tx' } });
  };
  const server = createApp().listen(0); await once(server, 'listening');
  const request = (path, body) => oldFetch(`http://localhost:${server.address().port}/api/hotels${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const response = await request('/rates', { hotelIds: ['hotel'], checkin: '2027-11-06', checkout: '2027-11-08', occupancies: [{ adults: 2 }] });
    assert.equal(response.status, 200); const offer = (await response.json()).data[0].roomTypes[0];
    assert.equal(offer.conditions.rooms[0].mealPlan, 'roomOnly'); assert.equal(offer.commission, undefined); assert.equal(offer.rates[0].rateId, undefined);
    const initial = await (await request('/prebook', { offerId: 'offer', previousTerms: { total: 369, currency: 'USD', conditions: offer.conditions } })).json();
    assert.deepEqual(initial.data.changes, []); assert.ok(initial.data.revision);
    const holder = { firstName: 'Miles', lastName: 'Traveler', email: 'guest@example.com' };
    const body = { offerId: 'offer', holder, guests: [{ ...holder, occupancyNumber: 1 }], acceptedRevision: initial.data.revision };
    total = 400;
    for (const path of ['/card/session', '/crypto-checkout', '/checkout']) {
      const changed = await request(path, body); assert.equal(changed.status, 409);
      const payload = await changed.json(); assert.equal(payload.code, 'HOTEL_TERMS_CHANGED'); assert.equal(payload.prebook.total, 400);
      assert.equal(payload.prebook.secretKey, undefined); assert.notEqual(payload.prebook.revision, initial.data.revision);
    }
    assert.equal(created, 0);
  } finally {
    await new Promise(resolve => server.close(resolve)); globalThis.fetch = oldFetch; TravelBooking.create = oldCreate;
    if (oldKey === undefined) delete process.env.NUITEE_API_KEY; else process.env.NUITEE_API_KEY = oldKey;
  }
});
