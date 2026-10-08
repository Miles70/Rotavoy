import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startSeoTestServer } from './seo-test-server.mjs';
import { markAnalyticsTest } from './analytics-test-context.mjs';
import { languages, copy } from '../seo/copy.js';
const server = await startSeoTestServer();
let browser;
try {
 browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
 await mkdir('test-results/seo', { recursive: true });
 for (const lang of languages) {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await markAnalyticsTest(context, { fixture: true });
  await context.route('**/api/**', route => route.abort());
  const page = await context.newPage();
  for (const suffix of ['', '/hotels/antalya', '/travel/hotels/lp55de7', '/flights/ayt-fra']) {
   const response = await page.goto(`${server.base}/${lang}${suffix}`);
   assert.equal(response.status(), 200);
   assert.ok((await page.locator('h1').textContent()).trim());
   assert.equal(await page.locator('html').getAttribute('lang'), lang);
   assert.equal(await page.locator('link[rel=canonical]').count(), 1);
   assert.equal(await page.locator('link[rel=alternate][hreflang]').count(), 11);
  }
  await context.close();
 }
 for (const width of [320, 390, 1280]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await markAnalyticsTest(context, { fixture: true });
  await context.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], hotels: [] }) }));
  await context.route('https://static.cupid.travel/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#19c6d8"/></svg>' }));
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${server.base}/tr/travel/hotels/lp55de7`);
  await page.getByRole('button', { name: copy.tr.theme }).click();
  await page.locator('.seoDark').waitFor();
  assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth), false);
  await page.screenshot({ path: `test-results/seo/hotel-${width}.png`, fullPage: true });
  await page.locator('.seoLanguages a[lang=ar]').click();
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  assert.ok((await page.locator('h1').textContent()).includes('Megasaray'));
  assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth), false);
  await page.goto(`${server.base}/tr/flights/ayt-fra`);
  await page.locator('.seoCta').click();
  await page.locator('.flightSearchForm').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'tr');
  assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, follow');
  assert.ok((await page.locator('.flightSearchForm').innerText()).includes(copy.tr.flightCta));
  const airportValues = await page.locator('.flightSearchForm input[role=combobox]').evaluateAll(nodes => nodes.map(node => node.value));
  assert.ok(airportValues.some(value => value.includes('Antalya')));
  assert.ok(airportValues.some(value => value.includes('Frankfurt')));
  const response = await page.goto(`${server.base}/tr/hotels/does-not-exist`);
  assert.equal(response.status(), 404);
  assert.equal(response.headers()['x-robots-tag'], 'noindex, follow');
  assert.deepEqual(errors, []);
  await context.close();
 }
 console.log('SEO browser tests: 10 languages without JavaScript, hydration, 320/390/1280px, RTL, theme, equivalent language links, route-to-search prefill and HTTP 404 passed.');
} finally { if (browser) await browser.close(); await server.close(); }
