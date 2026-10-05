import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { isTravelAdmin } from '../src/middleware/adminAuth.js';
import { CustomerSession } from '../src/models/CustomerSession.js';
import { TravelSupportTicket, TravelAdminAudit, TravelAdminSettings } from '../src/models/TravelAdmin.js';
import { HotelVideoIndex } from '../src/models/HotelVideoIndex.js';
import { adminBooking, bookingFilters } from '../src/routes/admin.js';

test('admin roles require a verified allowed identity; guests and unverified emails cannot escalate', () => {
  const previousLegacy = process.env.ADMIN_EMAIL; process.env.ADMIN_EMAIL = '';
  const previousEmails = process.env.ROTAVOY_ADMIN_EMAILS; const previousWallets = process.env.ROTAVOY_ADMIN_WALLETS;
  process.env.ROTAVOY_ADMIN_EMAILS = ' Owner@Example.com '; process.env.ROTAVOY_ADMIN_WALLETS = '0xABCD';
  try {
    assert.equal(isTravelAdmin({ provider: 'firebase', email: 'owner@example.com', emailVerified: true }), true);
    assert.equal(isTravelAdmin({ provider: 'firebase', email: 'owner@example.com', emailVerified: false }), false);
    assert.equal(isTravelAdmin({ provider: 'guest', email: 'owner@example.com', emailVerified: true }), false);
    assert.equal(isTravelAdmin({ provider: 'firebase', email: 'other@example.com', emailVerified: true }), false);
    assert.equal(isTravelAdmin({ provider: 'wallet', providerId: '0xabcd' }), true);
    assert.equal(isTravelAdmin({ provider: 'wallet', providerId: '0xaaaa' }), false);
    process.env.ROTAVOY_ADMIN_EMAILS = ''; process.env.ROTAVOY_ADMIN_WALLETS = '';
    assert.equal(isTravelAdmin({ provider: 'firebase', email: 'owner@example.com', emailVerified: true }), false);
  } finally { for (const [key, value] of [['ADMIN_EMAIL', previousLegacy], ['ROTAVOY_ADMIN_EMAILS', previousEmails], ['ROTAVOY_ADMIN_WALLETS', previousWallets]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
test('booking projection omits payment secrets and search treats user regex as literal', () => {
  const output = adminBooking({ clientReference: 'TRV-1', payment: { method: 'card', clientSecret: 'private', transactionId: 'private' }, providerBooking: { secret: 'private' } });
  assert.equal(JSON.stringify(output).includes('private'), false);
  const filter = bookingFilters({ q: '.*', status: 'confirmed', paymentStatus: 'paid' });
  assert.equal(filter.$or[0].clientReference.test('TRV-1'), false);
  assert.equal(filter.$or[0].clientReference.test('literal .*'), true);
  assert.equal(filter.status, 'confirmed'); assert.equal(filter.paymentStatus, 'paid');
});
test('admin HTTP access, ticket persistence, validation, showcase editing and audit stay protected', async () => {
  const previous = process.env.ROTAVOY_ADMIN_EMAILS; process.env.ROTAVOY_ADMIN_EMAILS = 'owner@example.com';
  const realFind = CustomerSession.findOne; const realCreate = TravelSupportTicket.create; const realAudit = TravelAdminAudit.create; const realUpdate = TravelAdminSettings.findOneAndUpdate; const realHotelUpdate = HotelVideoIndex.findOneAndUpdate;
  let identity = { provider: 'guest', providerId: 'guest-fixture', email: 'owner@example.com', emailVerified: true };
  const writes = []; const audits = [];
  CustomerSession.findOne = () => ({ populate: async () => ({ customer: identity, lastUsedAt: new Date() }) });
  TravelSupportTicket.create = async body => { writes.push(body); return { ...body, _id: 'fixture-ticket' }; };
  TravelAdminAudit.create = async body => { audits.push(body); return body; };
  TravelAdminSettings.findOneAndUpdate = (filter, body) => ({ lean: async () => body });
  HotelVideoIndex.findOneAndUpdate = (filter, body) => ({ lean: async () => ({ ...body, hotelId: filter.hotelId }) });
  const server = createApp().listen(0); await once(server, 'listening');
  const base = `http://localhost:${server.address().port}/api/admin`;
  const request = (path, body) => fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    for (const path of ['/session', '/overview', '/bookings', '/customers', '/hotels', '/providers', '/settings', '/tickets', '/content', '/audit']) assert.equal((await fetch(`${base}${path}`)).status, 401);
    assert.equal((await request('/session')).status, 403);
    assert.equal((await request('/tickets', { subject: 'Unauthorised' })).status, 403); assert.equal(writes.length, 0);
    identity = { provider: 'firebase', providerId: 'verified-fixture', email: 'owner@example.com', emailVerified: true };
    const session = await request('/session'); assert.equal(session.status, 200); assert.equal(session.headers.get('cache-control'), 'private, no-store');
    const created = await request('/tickets', { subject: 'TRV-1 refund request', type: 'refund', clientReference: 'TRV-1', note: 'Customer request', status: 'open', priority: 'high', role: 'admin' });
    assert.equal(created.status, 200); assert.equal(writes[0].type, 'refund'); assert.equal(writes[0].role, undefined); assert.equal(audits[0].actor, 'owner@example.com');
    assert.equal((await request('/tickets', { subject: 'Invalid', type: 'force_refund' })).status, 400); assert.equal(writes.length, 1);
    const settings = await fetch(`${base}/settings`, { method: 'PUT', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ supportEmail: 'invalid', marginPercent: 15 }) }); assert.equal(settings.status, 400);
    const updatedSettings = await fetch(`${base}/settings`, { method: 'PUT', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ supportEmail: 'support@example.com', marginPercent: 0, secret: 'ignore' }) }); assert.equal(updatedSettings.status, 200); const settingsBody = await updatedSettings.json(); assert.equal(settingsBody.settings.marginPercent, 0); assert.equal(settingsBody.settings.secret, undefined); assert.equal(audits.at(-1).action, 'settings.update');
    const hotel = await fetch(`${base}/hotels/hotel-1/showcase`, { method: 'PUT', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ showcaseVisible: false, showcasePriority: 50 }) }); assert.equal(hotel.status, 200); assert.equal((await hotel.json()).hotel.showcaseVisible, false); assert.equal(audits.at(-1).action, 'hotel.showcase');
    const invalidHotel = await fetch(`${base}/hotels/hotel-1/showcase`, { method: 'PUT', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ showcaseVisible: true, showcasePriority: 101 }) }); assert.equal(invalidHotel.status, 400);
    const unsupported = await fetch(`${base}/bookings/TRV-1/refund`, { method: 'POST', headers: { Authorization: 'Bearer fixture' } }); assert.equal(unsupported.status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve)); CustomerSession.findOne = realFind; TravelSupportTicket.create = realCreate; TravelAdminAudit.create = realAudit; TravelAdminSettings.findOneAndUpdate = realUpdate; HotelVideoIndex.findOneAndUpdate = realHotelUpdate;
    if (previous === undefined) delete process.env.ROTAVOY_ADMIN_EMAILS; else process.env.ROTAVOY_ADMIN_EMAILS = previous;
  }
});

test('admin margin validates overrides and preserves zero without doubling provider totals', async () => {
  const { resolveTravelMargin } = await import('../src/services/travelAdminSettings.js');
  assert.equal(resolveTravelMargin({ marginPercent: 0 }), 0);
  assert.equal(resolveTravelMargin({ marginPercent: 17.5 }), 17.5);
  assert.equal(resolveTravelMargin({ marginPercent: 101 }), 15);
});

test('checkout stay metadata rejects invalid dates and cannot alter booking/payment values', async () => {
  const { bookingStay } = await import('../src/services/bookingStay.js');
  const stay = bookingStay({ hotelId: 'hotel-1', hotelName: 'Sample Hotel', checkin: '2026-02-30', checkout: '2026-12-10', adults: 2, total: 1, paymentStatus: 'paid' });
  assert.equal(stay.checkin, ''); assert.equal(stay.checkout, '2026-12-10'); assert.equal(stay.adults, 2);
  assert.equal(stay.total, undefined); assert.equal(stay.paymentStatus, undefined);
  assert.deepEqual(bookingStay(null), { hotelId: '', hotelName: '', checkin: '', checkout: '', adults: null });
});


test('existing ADMIN_EMAIL grants verified owner access and explicit Travel list takes precedence', () => {
  const keys = ['ADMIN_EMAIL', 'ROTAVOY_ADMIN_EMAILS']; const previous = keys.map(key => process.env[key]);
  try {
    process.env.ADMIN_EMAIL = ' Owner@Example.com '; delete process.env.ROTAVOY_ADMIN_EMAILS;
    const owner = { provider: 'firebase', email: 'owner@example.com', emailVerified: true };
    assert.equal(isTravelAdmin(owner), true);
    assert.equal(isTravelAdmin({ ...owner, emailVerified: false }), false);
    assert.equal(isTravelAdmin({ ...owner, provider: 'guest' }), false);
    process.env.ROTAVOY_ADMIN_EMAILS = '   '; assert.equal(isTravelAdmin(owner), true);
    process.env.ROTAVOY_ADMIN_EMAILS = 'other@example.com'; assert.equal(isTravelAdmin(owner), false);
  } finally { keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; }); }
});
