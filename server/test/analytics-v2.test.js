import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createAnalyticsProof, classifyTraffic, effectiveTraffic } from '../src/services/analyticsTraffic.js';
import { analyticsFilter } from '../src/services/analyticsReport.js';
import { createApp } from '../src/app.js';
import { AdminSession } from '../src/models/AdminSession.js';
import { TravelAnalytics } from '../src/models/TravelAnalytics.js';
import { TravelBooking } from '../src/models/TravelBooking.js';
import { hashBookingAccess } from '../src/services/bookingAccess.js';

test('signed contexts reject forgery, expiration and key rotation; IP/country never establish a traffic class', () => {
  const previous = process.env.ROTAVOY_ADMIN_PASSWORD;
  process.env.ROTAVOY_ADMIN_PASSWORD = 'test-analytics-password';
  try {
    const now = Date.now();
    for (const kind of ['admin', 'test']) {
      const proof = createAnalyticsProof(kind, now);
      assert.equal(classifyTraffic(proof, 'HeadlessChrome', now).trafficType, kind);
      assert.equal(classifyTraffic(`${proof}x`, 'Mozilla', now).trafficType, 'unknown');
      assert.equal(classifyTraffic(proof, 'Mozilla', now + 9 * 3600000).trafficType, 'unknown');
    }
    const proof = createAnalyticsProof('test');
    process.env.ROTAVOY_ADMIN_PASSWORD = 'rotated-analytics-password';
    assert.equal(classifyTraffic(proof, 'Mozilla').trafficType, 'unknown');
    assert.equal(classifyTraffic('', 'Mozilla').trafficType, 'visitor');
    assert.equal(classifyTraffic('', 'HeadlessChrome').trafficType, 'suspected_bot');
    assert.equal(classifyTraffic('admin', 'Mozilla').trafficType, 'unknown');
    assert.equal(JSON.stringify(effectiveTraffic).includes('ip'), false);
  } finally { if (previous === undefined) delete process.env.ROTAVOY_ADMIN_PASSWORD; else process.env.ROTAVOY_ADMIN_PASSWORD = previous; }
});
test('V2 filters default to visitor traffic, bound dates and escape searches', () => {
  const now = new Date('2026-10-08T10:00:00Z');
  const result = analyticsFilter({ q: '.*', country: 'Germany', source: 'reddit', days: '99999' }, now);
  assert.equal(result.traffic, 'visitor');
  assert.equal(result.filter.country, 'Germany');
  assert.equal(result.filter.source, 'reddit');
  assert.equal(result.filter.$or[0].visitorId.test('anything'), false);
  assert.equal(result.filter.$or[0].visitorId.test('literal .*'), true);
  assert.equal(+result.from, +now - 365 * 86400000);
  for (const query of [{ from: 'bad' }, { from: '2026-02-30' }, { from: '2026-10-09', to: '2026-10-08' }, { from: '2020-01-01', to: '2026-10-08' }]) assert.throws(() => analyticsFilter(query), { statusCode: 400 });
  assert.equal(analyticsFilter({ traffic: 'test' }, now).traffic, 'test');
});
test('HTTP contexts require admin auth; booking conversion requires access + confirmed state and deduplicates without changing bookings', async () => {
  const previous = process.env.ROTAVOY_ADMIN_PASSWORD;
  process.env.ROTAVOY_ADMIN_PASSWORD = 'test-analytics-password';
  const original = { session: AdminSession.findOne, write: TravelAnalytics.updateOne, context: TravelAnalytics.findOne, booking: TravelBooking.findOne };
  AdminSession.findOne = async () => ({ _id: 'verified-admin' });
  TravelAnalytics.findOne = filter => ({ lean: async () => writes.get(filter.eventId) || null, sort: () => ({ select: () => ({ lean: async () => ({ country: 'Germany', source: 'reddit' }) }) }) });
  const writes = new Map();
  TravelAnalytics.updateOne = async (filter, update) => { if (!writes.has(filter.eventId)) writes.set(filter.eventId, update.$setOnInsert); };
  const booking = { status: 'processing', clientReference: 'private-reference', accessTokenHash: hashBookingAccess('booking-secret'), stay: { hotelName: 'Test hotel' } };
  TravelBooking.findOne = async () => booking;
  const server = createApp().listen(0); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}`;
  const event = { schemaVersion: 2, visitorId: 'visitor-123456', sessionId: 'session-123456', eventId: 'event-123456', type: 'page_view', path: '/travel', bookingReference: 'private-reference' };
  const post = (path, body, headers = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    assert.equal((await post('/api/admin/analytics/context', { kind: 'test' })).status, 401);
    const context = await post('/api/admin/analytics/context', { kind: 'test' }, { Authorization: `Bearer admin_${'a'.repeat(43)}` });
    assert.equal(context.status, 200); assert.equal(context.headers.get('cache-control'), 'private, no-store');
    const { proof } = await context.json();
    assert.equal((await post('/api/visits/events', { ...event, analyticsProof: proof, trafficType: 'visitor', ip: '1.2.3.4' })).status, 204);
    assert.equal(writes.get(event.eventId).trafficType, 'test');
    assert.equal(writes.get(event.eventId).ip, undefined);
    assert.equal((await post('/api/visits/events', { ...event, eventId: 'forged-confirmation', type: 'booking_confirmed' })).status, 400);
    assert.equal((await post('/api/visits/booking-confirmed', event)).status, 403);
    assert.equal((await post('/api/visits/booking-confirmed', event, { 'X-Booking-Token': 'booking-secret' })).status, 204);
    assert.equal(writes.size, 1);
    assert.equal((await post('/api/visits/booking-ready', { ...event, analyticsProof: proof }, { 'X-Booking-Token': 'booking-secret' })).status, 204);
    booking.status = 'confirmed';
    for (let i = 0; i < 2; i++) assert.equal((await post('/api/visits/booking-confirmed', { ...event, visitorId: 'different-return-visitor', sessionId: 'different-return-session' }, { 'X-Booking-Token': 'booking-secret' })).status, 204);
    assert.equal(writes.size, 3);
    const conversion = [...writes.values()].find(item => item.type === 'booking_confirmed');
    assert.equal(conversion.trafficType, 'test');
    assert.equal(conversion.visitorId, event.visitorId);
    assert.equal(conversion.bookingReference, undefined);
    assert.equal(conversion.details.hotelName, 'Test hotel');
    assert.equal(booking.status, 'confirmed');
  } finally {
    Object.assign(AdminSession, { findOne: original.session }); Object.assign(TravelAnalytics, { updateOne: original.write, findOne: original.context }); Object.assign(TravelBooking, { findOne: original.booking });
    if (previous === undefined) delete process.env.ROTAVOY_ADMIN_PASSWORD; else process.env.ROTAVOY_ADMIN_PASSWORD = previous;
    await new Promise(resolve => server.close(resolve));
  }
});
