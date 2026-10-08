import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { SITE_URL, TRAVEL_LANDINGS, travelAlternates, languageTag, travelLanding } from '../shared/travelSeo.js';
import { travelSeoCopy } from '../shared/travelSeoCopy.js';
import { sitemapXml } from '../api/sitemap.js';
import { markAnalyticsTest } from './analytics-test-context.mjs';

const config = JSON.parse(await readFile('vercel.json', 'utf8'));
const sitemap = sitemapXml();
assert.equal((sitemap.match(/<url>/g) || []).length, 27);
assert.equal((sitemap.match(/<xhtml:link /g) || []).length, 220);
for (const page of TRAVEL_LANDINGS) {
  assert.ok(config.rewrites.some(item => item.source === page.path && item.destination === `${page.path}.html`));
  const html = await readFile(`dist${page.path}.html`, 'utf8');
  assert.ok(html.includes(`lang="${languageTag(page.language)}"`));
  assert.ok(html.includes(`href="${SITE_URL}${page.path}"`));
  assert.ok(sitemap.includes(`${SITE_URL}${page.path}`));
}
assert.equal(travelLanding('/xx/flights'), null);
assert.equal(travelLanding('/tr/flights/checkout'), null);
for (const forbidden of ['/travel/checkout', '/flights/checkout', '/admin', '/account', '/travel</loc>']) assert.ok(!sitemap.includes(forbidden));
for (const source of ['/travel/checkout', '/flights/checkout', '/admin/:path*', '/account/:path*']) assert.ok(config.headers.some(item => item.source === source && item.headers.some(header => header.key === 'X-Robots-Tag' && header.value.includes('noindex'))));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://fixture.local').pathname);
    if (pathname === '/sitemap.xml') { response.setHeader('Content-Type', 'application/xml'); response.end(sitemap); return; }
    if (pathname.includes('..')) { response.writeHead(400); response.end(); return; }
    const landing = travelLanding(pathname);
    const filename = landing ? `dist${landing.path}.html` : pathname === '/' ? 'dist/index.html' : `dist${pathname}`;
    let body;
    try { body = await readFile(filename); } catch { body = await readFile('dist/index.html'); }
    response.setHeader('Content-Type', mime[path.extname(filename)] || 'text/html; charset=utf-8'); response.end(body);
  } catch { response.writeHead(500); response.end(); }
});
let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  await mkdir('test-results/seo', { recursive: true });
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  await markAnalyticsTest(noJs, { fixture: true });
  const crawler = await noJs.newPage();
  for (const page of TRAVEL_LANDINGS) {
    const copy = travelSeoCopy(page.category, page.language);
    assert.equal((await crawler.goto(base + page.path)).status(), 200);
    assert.equal(await crawler.title(), copy.title);
    assert.equal(await crawler.locator('h1').innerText(), copy.heading);
    assert.equal(await crawler.locator('head link[rel=canonical]').getAttribute('href'), SITE_URL + page.path);
    assert.equal(await crawler.locator('head meta[name=description]').count(), 1);
    assert.equal(await crawler.locator('head title').count(), 1);
    assert.equal(await crawler.locator('head meta[name=robots]').count(), 1);
    assert.ok(!(await crawler.locator('head meta[name=robots]').getAttribute('content')).includes('noindex'));
    assert.equal(await crawler.locator('head link[rel=alternate]').count(), 11);
    for (const alt of travelAlternates(page.category)) assert.equal(await crawler.locator(`head link[hreflang="${alt.language}"]`).getAttribute('href'), SITE_URL + alt.path);
    const schema = JSON.parse(await crawler.locator('script[type="application/ld+json"]').textContent());
    assert.equal(schema['@type'], 'WebPage'); assert.equal(schema.inLanguage, languageTag(page.language));
    assert.equal(schema.url, SITE_URL + page.path);
    for (const section of copy.sections) assert.ok((await crawler.locator('body').innerText()).includes(section.text));
    assert.equal(await crawler.locator('.travelSeoLanguages a').count(), 10);
  }
  await noJs.close(); console.log('SEO initial HTML: all 20 pages in 10 languages, content, canonical, reciprocal hreflang, schema and sitemap passed with JavaScript disabled.');
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'en-US' });
    await markAnalyticsTest(context, { fixture: true });
    await context.addInitScript(() => globalThis.localStorage.setItem('language', 'en'));
    await context.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], hotels: [], airports: [] }) }));
    // No external auth/provider/payment calls are needed for SEO navigation verification.
    await context.route('https://**', route => route.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const language of ['tr', 'ar', 'pt', 'en']) {
      const entry = TRAVEL_LANDINGS.find(item => item.language === language && item.category === 'flights');
      await page.goto(base + entry.path);
      await page.locator('.flightSearchForm').waitFor();
      assert.equal(await page.locator('html').getAttribute('lang'), languageTag(language));
      assert.equal(await page.locator('head title').count(), 1);
      assert.equal(await page.locator('head meta[name=description]').count(), 1);
      assert.equal(await page.locator('head meta[name=robots]').count(), 1);
      assert.equal(await page.locator('head link[rel=canonical]').count(), 1);
      assert.equal(await page.locator('head link[rel=alternate]').count(), 11);
      assert.equal(await page.locator('head link[rel=canonical]').getAttribute('href'), SITE_URL + entry.path);
      assert.equal(await page.locator('.travelSeoGuide').count(), 1);
      assert.equal(await page.locator('h1').count(), 1);
      const overflow = await page.evaluate(() => ({ width: globalThis.document.documentElement.scrollWidth, viewport: globalThis.innerWidth, elements: [...globalThis.document.querySelectorAll('body *')].map(element => ({ tag: element.tagName, class: element.className, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })).filter(element => element.right > globalThis.innerWidth + 1 || element.left < -1) }));
      assert.ok(overflow.width <= overflow.viewport, `flight overflow ${language}/${width}: ${JSON.stringify(overflow)}`);
    }
    await page.goto(`${base}/tr/flights?origin=AYT&destination=BCN&oneWay=1`);
    await page.locator('.flightSearchForm').waitFor();
    await page.locator('.languageButton').click(); await page.locator('.languageOption').filter({ hasText: 'Deutsch' }).click();
    await page.waitForURL('**/de/flights?origin=AYT&destination=BCN&oneWay=1');
    await page.waitForFunction(expected => globalThis.document.querySelector('link[rel="canonical"]')?.href === expected, `${SITE_URL}/de/flights`);
    assert.equal(await page.locator('head link[rel=canonical]').getAttribute('href'), `${SITE_URL}/de/flights`);
    assert.equal(await page.locator('head meta[name=description]').count(), 1);
    await page.screenshot({ path: `test-results/seo/flights-${width}-de.png`, fullPage: true });
    await page.goto(`${base}/tr/hotels`); await page.locator('.travelSeoGuide').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'tr');
    assert.equal(await page.locator('head meta[name=description]').count(), 1);
    assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth), false, `hotel overflow ${width}`);
    await page.locator('.travelSeoGuide').screenshot({ path: `test-results/seo/hotels-guide-${width}-tr.png` });
    // Legacy checkout URLs retain their original path and stay out of the index.
    await page.goto(`${base}/travel/checkout`); await page.waitForFunction(() => globalThis.document.querySelector('meta[name="robots"]')?.content.includes('noindex'));
    assert.equal(new URL(page.url()).pathname, '/travel/checkout');
    await page.goto(`${base}/flights/checkout`); await page.waitForFunction(() => globalThis.document.querySelector('meta[name="robots"]')?.content.includes('noindex'));
    await page.goto(`${base}/this-route-does-not-exist`); await page.waitForFunction(() => globalThis.document.querySelector('meta[name="robots"]')?.content.includes('noindex'));
    assert.deepEqual(errors, [], `runtime errors at ${width}`);
    await context.close(); console.log(`SEO browser: ${width}px, URL overrides storage, RTL, unique head, language switch preserves query, localized links and private/noindex routes passed.`);
  }
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
