import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import mongoose from '../server/node_modules/mongoose/index.js';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createApp } from '../server/src/app.js';
import { TravelAnalytics } from '../server/src/models/TravelAnalytics.js';
import { TravelBooking } from '../server/src/models/TravelBooking.js';
import { createPasswordAdminSession } from '../server/src/services/adminPasswordAuth.js';
import { createAnalyticsProof } from '../server/src/services/analyticsTraffic.js';
import { hashBookingAccess } from '../server/src/services/bookingAccess.js';
import { markAnalyticsTest } from './analytics-test-context.mjs';

// Only an isolated local database is accepted. Never use MONGODB_URI / production credentials.
const uri = process.env.ANALYTICS_TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017';
assert.match(uri, /^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\/?$/);
const dbName = `rotavoy_analytics_test_${process.pid}_${Date.now()}`;
process.env.ROTAVOY_ADMIN_PASSWORD = 'isolated-analytics-test-password';
process.env.CLIENT_ORIGINS = 'http://127.0.0.1:5176';
let api, vite, browser;
try {
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 });
  await TravelAnalytics.init();
  api = createApp().listen(0, '127.0.0.1'); await once(api, 'listening');
  const apiBase = `http://127.0.0.1:${api.address().port}`;
  const session = await createPasswordAdminSession(process.env.ROTAVOY_ADMIN_PASSWORD);
  const headers = { Authorization: `Bearer ${session.token}` };
  const report = async (query = '') => { const r = await fetch(`${apiBase}/api/admin/analytics/v2?${query}`, { headers }); assert.equal(r.status, 200, await r.clone().text()); return r.json(); };
  const now = Date.now();
  const fixtures = Array.from({ length: 28 }, (_, i) => ({ eventId: `fixture-event-${i}`, visitorId: `visitor-${String(i).padStart(8, '0')}`, sessionId: `session-fixture-${i}`, type: 'page_view', path: '/travel', country: i % 2 ? 'Türkiye' : 'Germany', device: i % 2 ? 'Mobil' : 'Masaüstü', browser: 'Chrome', source: i % 2 ? 'direct' : 'reddit', trafficType: 'visitor', classificationReason: 'no_exclusion_signal', createdAt: new Date(now - 3600000 - i * 1000) }));
  for (const kind of ['admin', 'test', 'suspected_bot', 'unknown']) fixtures.push({ ...fixtures[0], eventId: `fixture-${kind}`, visitorId: `visitor-${kind}`, sessionId: `session-${kind}`, trafficType: kind });
  const legacy = { ...fixtures[0], eventId: 'legacy-event', visitorId: 'legacy-visitor', sessionId: 'legacy-session', ip: '1.2.3.4', identity: 'legacy@example.test', bot: false }; delete legacy.trafficType; fixtures.push(legacy);
  const stages = ['room_select', 'hotel_view', 'room_select', 'checkout_view', 'payment_start', 'payment_ready'];
  stages.forEach((type, i) => fixtures.push({ ...fixtures[0], eventId: `funnel-${i}`, type, details: { hotelId: 'fixture-hotel', hotelName: 'Analytics Test Hotel', roomName: 'Sea view suite' }, createdAt: new Date(now - 20000 + i * 1000) }));
  // Separate out-of-order session must not inflate the ordered funnel.
  fixtures.push({ ...fixtures[1], eventId: 'out-of-order-payment', type: 'payment_ready' });
  fixtures.push({ ...fixtures[1], eventId: 'flight-fixture', type: 'flight_search', details: { origin: 'AYT', destination: 'BCN' } });
  await TravelAnalytics.collection.insertMany(fixtures);
  const before = await TravelAnalytics.countDocuments();
  const standard = await report();
  assert.equal(standard.totals.visitors, 28); assert.equal(standard.visitors.length, 25);
  assert.equal(standard.funnel.payment_ready, 1); assert.equal(standard.funnel.hotel_view, 1);
  assert.equal(standard.live, 1); assert.equal(standard.flights[0]._id.destination, 'BCN');
  assert.equal((await report('page=2')).visitors.length, 3);
  assert.equal((await report('traffic=unknown')).totals.visitors, 2);
  assert.equal((await report('traffic=test')).totals.visitors, 1);
  assert.equal((await report('traffic=all')).totals.visitors, 33);
  assert.equal((await report('country=Germany&source=reddit')).totals.visitors, 14);
  assert.equal((await report('country=Nowhere')).totals.visitors, 0);
  const legacyReport = await report('traffic=unknown&visitorId=legacy-visitor');
  assert.equal(JSON.stringify(legacyReport).includes('legacy@example.test'), false);
  assert.equal(JSON.stringify(legacyReport).includes('1.2.3.4'), false);
  assert.equal(await TravelAnalytics.countDocuments(), before); // No historical rewrite / deletion.
  assert.equal((await fetch(`${apiBase}/api/admin/analytics/v2`)).status, 401);
  const testProof = createAnalyticsProof('test');
  const ingest = async (type, id, extra = {}, auth = {}) => fetch(`${apiBase}/api/visits/${type === 'booking_confirmed' ? 'booking-confirmed' : type === 'payment_ready' && extra.bookingReference ? 'booking-ready' : 'events'}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', ...auth }, body: JSON.stringify({ schemaVersion: 2, eventId: id, visitorId: 'visitor-ingestion', sessionId: 'session-ingestion', type, path: '/travel', ...extra }) });
  assert.equal((await ingest('page_view', 'verified-test-event', { analyticsProof: testProof, trafficType: 'visitor' })).status, 204);
  assert.equal((await report()).totals.visitors, 28);
  assert.equal((await report('traffic=test')).totals.visitors, 2);
  assert.equal((await ingest('page_view', 'expired-test-event', { analyticsProof: 'forged-proof' })).status, 204);
  assert.equal((await report()).totals.visitors, 28);
  await TravelBooking.collection.insertOne({ clientReference: 'fixture-booking', accessTokenHash: hashBookingAccess('fixture-booking-secret'), status: 'confirmed', kind: 'hotel', stay: { hotelId: 'fixture-hotel' } });
  const confirmation = { visitorId: fixtures[0].visitorId, sessionId: fixtures[0].sessionId, bookingReference: 'fixture-booking' };
  assert.equal((await ingest('booking_confirmed', 'untrusted-conversion', confirmation)).status, 403);
  assert.equal((await ingest('payment_ready', 'linked-ready-event', confirmation, { 'X-Booking-Token': 'fixture-booking-secret' })).status, 204);
  for (let i = 0; i < 2; i++) assert.equal((await ingest('booking_confirmed', `conversion-${i}`, confirmation, { 'X-Booking-Token': 'fixture-booking-secret' })).status, 204);
  const converted = await report('country=Germany&source=reddit');
  assert.equal(converted.confirmed[0].count, 1); assert.equal(converted.funnel.booking_confirmed, 1);
  assert.equal((await TravelBooking.findOne({ clientReference: 'fixture-booking' })).status, 'confirmed');
  console.log('Analytics API + Mongo: default exclusions, legacy preservation, filters, pagination, ordered funnel, authorized/deduplicated conversions passed.');

  vite = await createServer({ server: { host: '127.0.0.1', port: 5176, strictPort: true, proxy: { '/api': apiBase } }, define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(''), 'import.meta.env.VITE_REOWN_PROJECT_ID': JSON.stringify('00000000000000000000000000000000') } });
  await vite.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}) });
  await mkdir('test-results/analytics-v2', { recursive: true });
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'tr-TR' });
    await markAnalyticsTest(context, { apiBaseUrl: apiBase, adminToken: session.token });
    await context.addInitScript(value => { globalThis.localStorage.setItem('rotavoy_admin_session_v2', JSON.stringify(value)); globalThis.localStorage.setItem('language', 'tr'); }, session);
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5176/admin/analytics');
    await page.locator('.avVisitor').first().waitFor();
    assert.equal(await page.locator('.avVisitor').count(), 25);
    assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth), false, `dashboard overflow ${width}`);
    await page.locator('.avVisitor').first().click();
    await page.locator('.avJourney li').first().waitFor();
    assert.ok((await page.locator('.avJourney').innerText()).includes('Oturum'));
    await page.locator('.avVisitor').first().click();
    for (const theme of ['light', 'dark']) {
      if (await page.locator('.travelAdmin').getAttribute('data-theme') !== theme) await page.locator('.adminThemeToggle').click();
      await page.locator('.analyticsV2').screenshot({ path: `test-results/analytics-v2/dashboard-${width}-${theme}.png` });
    }
    await page.getByLabel('Ziyaretçi türü').selectOption('test');
    await page.waitForResponse(r => r.url().includes('/analytics/v2?') && r.url().includes('traffic=test') && r.status() === 200);
    await page.locator('.avVisitor').first().waitFor();
    assert.ok((await page.locator('.avVisitors').innerText()).includes('Doğrulanmış test'));
    await page.getByLabel('Ülke', { exact: true }).fill('Nowhere');
    await page.getByText('Bu filtrelerde ziyaretçi yok.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Sıfırla', exact: true }).click();
    await page.locator('.avVisitor').first().waitFor();
    // Actual browser queue → signed test context → Express → Mongo, without provider calls.
    await page.evaluate(async () => {
      globalThis.history.replaceState({}, '', '/analytics-fixture');
      const analytics = await import('/src/services/analytics.js');
      analytics.trackTravel('hotel_view', { hotelId: 'browser-fixture', hotelName: 'Browser tracked hotel' });
      await analytics.flushTravelAnalytics();
    });
    assert.ok(await TravelAnalytics.exists({ 'details.hotelId': 'browser-fixture', trafficType: 'test' }));
    assert.equal((await report()).totals.visitors, 28);
    assert.deepEqual(errors, []);
    await context.close(); console.log(`Analytics browser: ${width}px, light/dark, no overflow, journey, filters, empty state, signed test ingestion passed.`);
  }
} finally {
  if (browser) await browser.close();
  if (vite) await vite.close();
  if (api) await new Promise(resolve => api.close(resolve));
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
