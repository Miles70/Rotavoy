import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { CustomerSession } from '../src/models/CustomerSession.js';
import { TravelAccount } from '../src/models/TravelAccount.js';
import { TravelBooking } from '../src/models/TravelBooking.js';
import { TravelSupportTicket } from '../src/models/TravelAdmin.js';
import { publicBooking } from '../src/routes/account.js';
import { hashCustomerToken } from '../src/services/customerAuthService.js';
test('account records are isolated by authenticated owner; support never exposes internal notes', async () => {
  const originals = [];
  const stub = (obj, key, value) => { originals.push([obj, key, obj[key]]); obj[key] = value; };
  const alice = '507f1f77bcf86cd799439011', bob = '507f1f77bcf86cd799439012';
  const seen = [];
  stub(CustomerSession, 'findOne', filter => ({ populate: async () => filter.tokenHash === hashCustomerToken('alice') ? { customer: { _id: alice, email: 'alice@example.com' }, lastUsedAt: new Date() } : filter.tokenHash === hashCustomerToken('bob') ? { customer: { _id: bob }, lastUsedAt: new Date() } : null }));
  stub(TravelAccount, 'findOne', filter => { seen.push(filter); return { lean: async () => ({ favorites: [{ hotelId: `hotel-${filter.customerId}` }], travelers: [] }) }; });
  stub(TravelAccount, 'updateOne', async (filter, update) => { seen.push(filter); seen.push(update); return {}; });
  stub(TravelAccount, 'findOneAndUpdate', async (filter, update) => { seen.push(filter); seen.push(update); return { travelers: [] }; });
  const chain = value => ({ sort() { return this; }, limit() { return this; }, select() { return this; }, lean: async () => value });
  stub(TravelBooking, 'find', filter => { seen.push(filter); return chain([{ clientReference: `ref-${filter.customerId}`, status: 'confirmed', payment: { clientSecret: 'secret' }, providerBooking: { secret: 'provider-secret' } }]); });
  stub(TravelBooking, 'exists', async filter => { seen.push(filter); return filter.clientReference === 'alice-booking' && filter.customerId === alice; });
  stub(TravelSupportTicket, 'find', filter => { seen.push(filter); return { select(fields) { assert.ok(!fields.includes('note')); assert.ok(!fields.includes('createdBy')); return chain([{ subject: 'My ticket', reply: 'Public answer' }]); } }; });
  stub(TravelSupportTicket, 'countDocuments', async () => 0);
  stub(TravelSupportTicket, 'create', async body => { seen.push(body); return { ...body, _id: 'ticket', status: 'open' }; });
  const server = createApp().listen(0); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}/api/account`;
  const request = (path = '', token = 'alice', method = 'GET', body) => fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await request('', '', 'GET')).status, 401);
    const a = await (await request('?customerId=' + bob)).json();
    assert.equal(a.bookings[0].clientReference, `ref-${alice}`); assert.equal(a.bookings[0].payment, undefined); assert.equal(a.bookings[0].providerBooking, undefined);
    const b = await (await request('', 'bob')).json(); assert.equal(b.favorites[0].hotelId, `hotel-${bob}`);
    assert.equal((await request('/tickets', 'alice', 'POST', { subject: 'Help', message: 'Question', clientReference: 'bob-booking', customerId: bob })).status, 400);
    assert.equal((await request('/tickets', 'alice', 'POST', { subject: 'Help', message: 'Question', clientReference: 'alice-booking', customerId: bob, status: 'resolved', note: 'forged' })).status, 201);
    const ticket = seen.find(v => v.message === 'Question'); assert.equal(ticket.customerId, alice); assert.equal(ticket.status, undefined); assert.equal(ticket.note, undefined);
    assert.equal((await request('/travelers', 'alice', 'POST', { firstName: 'Ada', lastName: 'Lovelace', email: 'bad' })).status, 400);
    assert.equal((await request('/travelers', 'alice', 'POST', { firstName: 'Ada', lastName: 'Lovelace', customerId: bob })).status, 201);
    const mutation = seen.find(v => v.$push?.travelers); assert.equal(mutation.$push.travelers.customerId, undefined);
    assert.equal((await request('/favorites/a-hotel', 'alice', 'PUT', { name: 'Hotel', image: 'javascript:alert(1)', customerId: bob })).status, 204);
    assert.equal(seen.find(v => v.$push?.favorites).$push.favorites.image, '');
    assert.equal((await request('/travelers/not-an-id', 'alice', 'DELETE')).status, 400);
    assert.equal((await request('/favorites/a-hotel', 'alice', 'DELETE')).status, 204);
    assert.equal(seen.filter(v => v.customerId).every(v => [alice, bob].includes(v.customerId)), true);
  } finally { for (const [obj, key, original] of originals) obj[key] = original; await new Promise(resolve => server.close(resolve)); }
});
test('customer booking summary excludes payment credentials and provider internals', () => {
  const result = publicBooking({ clientReference: 'ref', payment: { clientSecret: 'secret' }, providerBooking: { token: 'secret' }, customerId: 'owner', failureReason: 'internal' });
  assert.equal(result.payment, undefined); assert.equal(result.providerBooking, undefined); assert.equal(result.customerId, undefined); assert.equal(result.failureReason, undefined);
});
