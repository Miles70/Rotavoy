import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { sanitizeAnalytics } from '../src/routes/analytics.js';
import { TravelAnalytics } from '../src/models/TravelAnalytics.js';
import { CustomerSession } from '../src/models/CustomerSession.js';
import { AdminSession } from '../src/models/AdminSession.js';
const event = { visitorId: 'visitor-12345', sessionId: 'session-12345', eventId: 'event-123456', type: 'flight_search', path: '/flights?token=secret', details: { origin: 'AYT', destination: 'LHR', adults: 2, password: 'private' }, referrer: 'https://example.com/search?private=secret' };
test('analytics accepts only bounded travel fields and rejects invalid/admin events', () => {
  const result = sanitizeAnalytics({ ...event, identity: 'fake-owner', ip: 'spoofed' });
  assert.equal(result.path, '/flights'); assert.equal(result.referrer, 'https://example.com');
  assert.deepEqual(result.details, { origin: 'AYT', destination: 'LHR', adults: '2' });
  assert.equal(result.identity, undefined); assert.equal(result.ip, undefined);
  for (const body of [{ ...event, type: 'arbitrary' }, { ...event, path: '/admin' }, { ...event, path: '//evil' }, { ...event, visitorId: { $gt: '' } }, { ...event, sessionId: '' }]) assert.equal(sanitizeAnalytics(body), null);
});
test('analytics ingestion persists anonymous and authenticated events, deduplicates IDs, and protects admin reads', async () => {
  const writes = new Map(); const realWrite = TravelAnalytics.updateOne; const realSession = CustomerSession.findOne;
  TravelAnalytics.updateOne = async (filter, update) => { if (!writes.has(filter.eventId)) writes.set(filter.eventId, update.$setOnInsert); };
  CustomerSession.findOne = () => ({ populate: async () => ({ customer: { _id: 'customer-id', email: 'traveler@example.com', provider: 'firebase', emailVerified: true }, lastUsedAt: new Date() }) });
  const server = createApp().listen(0); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const post = (body, token) => fetch(`${base}/api/visits/events`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer verified' } : {}) }, body: JSON.stringify(body) });
    assert.equal((await post(event)).status, 204); assert.equal((await post(event)).status, 204); assert.equal(writes.size, 1);
    const saved = writes.get(event.eventId); assert.equal(saved.identity, ''); assert.equal(saved.ip, undefined); assert.equal(saved.city, undefined);
    assert.equal((await post({ ...event, eventId: 'authenticated-123', identity: 'spoofed' }, true)).status, 204);
    assert.equal(writes.get('authenticated-123').identity, '');
    assert.equal((await post({ ...event, type: 'invalid' })).status, 400);
    assert.equal((await fetch(`${base}/api/admin/analytics`)).status, 401);
    assert.equal((await fetch(`${base}/api/admin/analytics`, { headers: { Authorization: 'Bearer verified' } })).status, 401);
  } finally { TravelAnalytics.updateOne = realWrite; CustomerSession.findOne = realSession; await new Promise(resolve => server.close(resolve)); }
});
test('admin analytics filters visitor journeys and returns totals without allowing regex injection', async () => {
  const previousPassword = process.env.ROTAVOY_ADMIN_PASSWORD; process.env.ROTAVOY_ADMIN_PASSWORD = 'test-admin-password';
  const real = { find: TravelAnalytics.find, count: TravelAnalytics.countDocuments, aggregate: TravelAnalytics.aggregate, session: AdminSession.findOne };
  let captured;
  AdminSession.findOne = async () => ({ _id: 'admin-session' });
  TravelAnalytics.find = filter => { captured = filter; const chain = { sort: () => chain, skip: () => chain, limit: () => chain, lean: async () => [{ _id: 'fixture', visitorId: 'visitor-12345', type: 'flight_search', details: { origin: 'AYT', destination: 'LHR' } }] }; return chain; };
  TravelAnalytics.countDocuments = async () => 1;
  TravelAnalytics.aggregate = async () => [{ visitors: [{ count: 1 }], sessions: [{ count: 1 }], types: [{ _id: 'flight_search', count: 1 }] }];
  const server = createApp().listen(0); await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/analytics?visitorId=visitor-12345&q=.*&days=9999&bots=exclude&type=flight_search&limit=999`, { headers: { Authorization: 'Bearer admin_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const data = await response.json(); assert.equal(data.days, 365); assert.equal(data.limit, 100); assert.equal(data.total, 1); assert.equal(data.summary.visitors[0].count, 1);
    assert.equal(captured.visitorId, 'visitor-12345'); assert.equal(captured.type, 'flight_search'); assert.deepEqual(captured.bot, { $ne: true });
    assert.equal(captured.$or[0].visitorId.test('anything'), false); assert.equal(captured.$or[0].visitorId.test('literal .*'), true);
    assert.equal(data.items[0].details.origin, 'AYT');
  } finally { TravelAnalytics.find = real.find; TravelAnalytics.countDocuments = real.count; TravelAnalytics.aggregate = real.aggregate; AdminSession.findOne = real.session; if (previousPassword === undefined) delete process.env.ROTAVOY_ADMIN_PASSWORD; else process.env.ROTAVOY_ADMIN_PASSWORD = previousPassword; await new Promise(resolve => server.close(resolve)); }
});

