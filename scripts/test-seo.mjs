import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildPages, SITE_URL, eligibleHotel } from '../seo/model.js';
import { languages, copy } from '../seo/copy.js';
import { appPolicy } from '../seo/app-policy.js';
import handler from '../api/page.js';
import { safeJson } from '../seo/html.js';
const hotels = await Promise.all((await readdir('seo/hotels')).filter(f => f.endsWith('.json')).map(async f => JSON.parse(await readFile(`seo/hotels/${f}`, 'utf8'))));
const pages = buildPages(hotels);
assert.ok(pages.length > 0 && pages.length % languages.length === 0);
const paths = new Set(pages.map(p => p.path));
assert.equal(paths.size, pages.length);
for (const h of hotels) {
 assert.ok(eligibleHotel(h));
 assert.equal(createHash('sha256').update(h.source.description).digest('hex'), h.source.descriptionHash);
 assert.equal(eligibleHotel({ ...h, source: { ...h.source, environment: 'sandbox' } }), false);
 assert.equal(eligibleHotel({ ...h, descriptions: { en: h.descriptions.en } }), false);
 assert.equal(eligibleHotel({ ...h, deletedAt: '2026-10-08' }), false);
 assert.equal(eligibleHotel({ ...h, published: false }), false);
}
for (const lang of languages) {
 assert.equal(pages.filter(p => p.lang === lang).length, pages.length / languages.length);
 assert.ok(Object.values(copy[lang]).every(value => typeof value === 'string' && value.length));
}
for (const page of pages) {
 const html = await readFile(`dist/${page.path.slice(1)}.html`, 'utf8');
 assert.equal((html.match(/<link rel="canonical"/g) || []).length, 1);
 assert.ok(html.includes(`href="${SITE_URL}${page.path}"`));
 assert.ok(html.includes(`lang="${page.lang}"`));
 assert.ok(html.includes(`dir="${page.lang === 'ar' ? 'rtl' : 'ltr'}"`));
 assert.ok(html.includes('<h1>') && html.includes('application/ld+json'));
 assert.equal((html.match(/hreflang=/g) || []).length, 11);
 assert.ok(!html.includes('noindex') && !html.includes('<!--seo-'));
 const data = JSON.parse(html.match(/<script id="seo-page-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(data.path, page.path);
 const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.ok(!JSON.stringify(schema).includes('Offer') && !JSON.stringify(schema).includes('AggregateRating'));
 for (const a of page.alternates) {
  assert.ok(paths.has(a.path));
  const target = pages.find(p => p.path === a.path);
  assert.ok(target.alternates.some(back => back.path === page.path));
 }
 for (const match of html.matchAll(/href="(\/[^"?#]+)"/g)) {
  if (match[1].startsWith('/assets/') || match[1].startsWith('/brand/')) continue;
  assert.ok(paths.has(match[1]), `Broken SEO link ${page.path} -> ${match[1]}`);
 }
 const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/g, '');
 assert.ok(withoutScripts.includes(page.title) || page.title.includes('&'));
 if (page.kind === 'hotel') assert.ok(withoutScripts.includes(page.hotel.address));
 if (page.kind === 'route') assert.ok(withoutScripts.includes(page.route.from) && withoutScripts.includes(page.route.to));
}
const index = await readFile('dist/sitemap.xml', 'utf8');
assert.ok(index.includes('<sitemapindex'));
let locations = [];
for (const match of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
 const file = await readFile(`dist${new URL(match[1]).pathname}`, 'utf8');
 const locs = [...file.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
 locations.push(...locs);
 assert.ok(locs.length <= 50000 && Buffer.byteLength(file) < 50 * 1024 * 1024);
}
for (const path of paths) assert.ok(locations.includes(SITE_URL + path));
assert.ok(locations.every(url => !url.includes('?') && !/checkout|account|admin/.test(url)));
const published = hotels.map(h => h.id);
for (const [path, search] of [['/flights', 'departure=2099-01-01'], ['/travel/checkout',''], ['/flights/checkout',''], ['/account',''], ['/admin',''], ['/hotels','cityName=Antalya'], ['/travel/hotels/lp55de7','checkin=2099-01-01'], ['/not-a-page',''], ['/en/hotels/not-a-city','']]) assert.ok(appPolicy(path, search, published).noIndex);
assert.equal(appPolicy('/not-a-page', '', published).status, 404);
assert.equal(appPolicy('/flights', '', published).redirect, '/en/flights');
assert.equal(appPolicy('/travel/hotels/lp55de7', '', published).redirect, '/en/travel/hotels/lp55de7');
assert.equal(appPolicy('/travel', 'cityName=Antalya', published).redirect, '/?cityName=Antalya');
assert.ok(!safeJson({ title: '</script><script>alert(1)</script>' }).includes('<'));
async function request(path) {
 const url = new URL(path, SITE_URL);
 const internal = `/api/page?${new URLSearchParams({ path: url.pathname.slice(1), ...Object.fromEntries(url.searchParams) })}`;
 const headers = {}, result = {};
 const response = { setHeader: (key, value) => { headers[key] = value; }, status: code => { result.status = code; return response; }, send: body => { result.body = body; }, end: () => {} };
 await handler({ url: internal }, response);
 return { ...result, headers };
}
for (const path of ['/account','/travel/checkout','/flights/checkout','/flights?departure=2099-01-01','/missing','/de/hotels/missing']) {
 const r = await request(path);
 assert.equal(r.status, path.includes('missing') ? 404 : 200);
 assert.equal(r.headers['X-Robots-Tag'], 'noindex, follow');
 assert.ok(r.body.includes('content="noindex, follow"'));
 assert.equal((r.body.match(/rel="canonical"/g) || []).length, 1);
}
assert.equal((await request('/flights')).status, 308);
assert.equal((await request('/flights?lang=tr')).headers['Cache-Control'], 'private, no-store');
console.log(`SEO passed: ${pages.length} JavaScript-free HTML pages, 10 languages, reciprocal hreflang, canonical, schema, links, sitemap, publication gates, redirects, HTTP 404 and private noindex.`);
