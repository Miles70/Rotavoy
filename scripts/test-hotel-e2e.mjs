import { markAnalyticsTest } from './analytics-test-context.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { normalizeOfferConditions, publicPrebook } from '../server/src/services/hotelRateConditions.js';

// Browser fixtures use the observed LiteAPI structures, with synthetic prices,
// identities and dates. No provider booking or financial transaction is made.
const cancellationPolicies = { refundableTag: 'RFN', cancelPolicyInfos: [{ cancelTime: '2099-11-04 18:00:00', amount: 150, currency: 'USD', type: 'amount', timezone: 'GMT' }] };
const rate = { name: `Superior Room, 1 King Bed · ${'LongRoomName'.repeat(12)}`, boardType: 'BI', boardName: 'Breakfast Included', adultCount: 2, childCount: 0, cancellationPolicies, retailRate: { taxesAndFees: [{ included: false, description: 'Property service charge', amount: 34.4, currency: 'USD' }] } };
const offer = { offerId: 'browser-fixture', suggestedSellingPrice: { amount: 300, currency: 'USD' }, rates: [{ name: rate.name }], conditions: normalizeOfferConditions({ rates: [rate] }) };
const raw = { price: 300, currency: 'USD', hotelId: 'fixture-hotel', roomTypes: [{ rates: [rate] }], checkin: '2099-11-06', checkout: '2099-11-08' };
const initial = publicPrebook(raw), updated = publicPrebook({ ...raw, price: 320, roomTypes: [{ rates: [{ ...rate, boardType: 'AI' }] }] });
const image = 'https://fixture.test/room1.jpg';
const imageSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#19c6d8"/></svg>';
const hotel = { id: 'fixture-hotel', name: 'Browser validation hotel', main_photo: image, hotelImages: [{ url: image }, { url: "https://fixture.test/room2.jpg" }], address: 'Test address', city: 'Phuket', country: 'TH', stars: 5 };
const server = await createServer({ server: { host: '127.0.0.1', port: 5174, strictPort: true }, define: { 'import.meta.env.VITE_REOWN_PROJECT_ID': JSON.stringify('00000000000000000000000000000000'), 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  await mkdir('test-results/hotel-ui', { recursive: true });
  for (const width of [320, 390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'tr-TR' });
    await markAnalyticsTest(context, { fixture: true });
    await context.addInitScript(() => globalThis.localStorage.setItem('language', 'tr'));
    await context.route('https://fixture.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: imageSvg }));
    let paymentAttempts = 0;
    await context.route('**/api/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      let payload = { data: [], hotels: [] }, status = 200;
      if (pathname === '/api/hotels/rates') payload = { data: [{ hotelId: 'fixture-hotel', roomTypes: [offer] }], hotels: [hotel] };
      else if (pathname === '/api/hotels/fixture-hotel') payload = { data: hotel };
      else if (pathname === '/api/hotels/prebook') payload = { data: initial };
      else if (pathname.endsWith('/card/session') || pathname.endsWith('/crypto-checkout')) {
        paymentAttempts++;
        assert.equal(JSON.parse(route.request().postData()).acceptedRevision, initial.revision);
        status = 409; payload = { code: 'HOTEL_TERMS_CHANGED', prebook: updated };
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });
    });
    const page = await context.newPage();
    const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:5174/travel/hotels/fixture-hotel?checkin=2099-11-06&checkout=2099-11-08&adults=2');
    await page.getByRole('button', { name: 'Bu odayı seç', exact: true }).waitFor();
    assert.equal(await page.title(), 'Browser validation hotel | VoyHaven');
    assert.equal(await page.locator('link[rel=canonical]').count(), 1);
    assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, follow');
    assert.ok((await page.locator('meta[name=description]').getAttribute('content')).includes('Test address'));
    await page.getByRole('button', { name: 'Sonraki fotoğraf', exact: true }).click();
    const card = page.locator('.hotelOffer');
    assert.ok((await card.innerText()).includes('Kahvaltı Dahil'));
    assert.ok((await card.innerText()).includes('Ücretsiz iptal'));
    assert.ok((await card.innerText()).includes('34,40'));
    await card.locator('summary').click();
    assert.ok((await card.innerText()).includes('150'));
    const overflow = await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth);
    assert.equal(overflow, false, `hotel details overflow at ${width}px`);
    await card.screenshot({ path: `test-results/hotel-ui/card-${width}.png` });
    await page.getByRole('button', { name: 'Bu odayı seç', exact: true }).click();
    await page.locator('.hotelBookSelected').click();
    await page.waitForURL('**/travel/checkout');
    const submit = page.locator('.travelCheckoutSubmit');
    assert.equal(await submit.isDisabled(), true);
    await page.getByLabel('Ad', { exact: true }).first().fill('Miles');
    await page.getByLabel('Soyad', { exact: true }).first().fill('Traveler');
    await page.getByLabel('E-posta', { exact: true }).fill('guest@example.com');
    await page.getByLabel('Telefon', { exact: true }).fill('5551234567');
    await page.getByLabel('Ad', { exact: true }).last().fill('Miles');
    await page.getByLabel('Soyad', { exact: true }).last().fill('Traveler');
    if (width === 390) await page.getByRole('button', { name: /Kripto/i }).click();
    await page.locator('.rateTermsAccept input').check();
    assert.equal(await submit.isEnabled(), true);
    await submit.click();
    await page.getByRole('heading', { name: 'Rezervasyon koşulları güncellendi' }).waitFor();
    assert.equal(paymentAttempts, 1);
    assert.equal(await page.locator('.rateTermsAccept input').isChecked(), false);
    assert.equal(await submit.isDisabled(), true);
    assert.ok((await page.locator('.rateTermsUpdate').innerText()).includes('Fiyat güncellendi'));
    assert.ok((await page.locator('.rateConditions').first().innerText()).includes('Her Şey Dahil'));
    assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth), false, `checkout overflow at ${width}px`);
    assert.ok((await page.locator('.travelCheckoutBack').getAttribute('href')).endsWith('/fixture-hotel'));
    await page.locator('.rateTermsUpdate').screenshot({ path: `test-results/hotel-ui/changes-${width}.png` });
    await page.screenshot({ path: `test-results/hotel-ui/checkout-${width}.png`, fullPage: true });
    assert.deepEqual(pageErrors, [], `browser exceptions at ${width}px`);
    await context.close();
    console.log(`Hotel browser flow passed at ${width}px: long name, meals, cancellation, fees, disclosure, selection, prebook, ${width === 390 ? 'crypto' : 'card'} changes, renewed consent and confirmed hotel return URL.`);
  }
} finally { if (browser) await browser.close(); await server.close(); }
