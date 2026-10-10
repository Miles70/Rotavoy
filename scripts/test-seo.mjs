import { travelGuide } from "../seo/guides.js";
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildPages, SITE_URL, eligibleHotel } from '../seo/model.js';
import { languages, copy } from '../seo/copy.js';
import { hotelFactsChanged } from '../seo/hotel-refresh.js';
import { appPolicy, searchKeys } from '../seo/app-policy.js';
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
 if (['hotels', 'flights'].includes(page.kind)) {
  for (const section of travelGuide(page.kind, page.lang).sections) assert.ok(withoutScripts.includes(section.text.replaceAll('&', '&amp;').replaceAll("'", '&#x27;').replaceAll('"', '&quot;')));
 }
 if (page.kind === 'hotel') assert.ok(withoutScripts.includes(page.hotel.address));
 if (page.kind === 'route') assert.ok(withoutScripts.includes(page.route.from) && withoutScripts.includes(page.route.to));
}
assert.equal(await readFile('dist/google2fd19590f23b16c5.html', 'utf8'), await readFile('public/google2fd19590f23b16c5.html', 'utf8'));
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
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
// Migration must cover every published URL without redirecting new-domain
// traffic or interrupting old-origin checkout callbacks.
const migrationRedirect = (host, path, query = '') => {
 for (const rule of config.redirects) {
  if (!rule.has.some(condition => condition.type === 'host' && condition.value === host) || !rule.missing.every(condition => !new URLSearchParams(query).has(condition.key))) continue;
  if (rule.source === path) return rule;
  const locale = path.match(/^\/(tr|en|de|fr|ru|ar|es|pt|it|zh)(?:\/(.*))?$/);
  if (locale && rule.source.startsWith('/:lang(')) return { ...rule, destination: rule.destination.replace(':lang', locale[1]).replace('/:path*', locale[2] ? '/' + locale[2] : '') };
  const hotel = path.match(/^\/travel\/hotels\/(lp[a-z0-9]+)$/);
  if (hotel && rule.source.startsWith('/travel/hotels/:hotelId(')) return { ...rule, destination: rule.destination.replace(':hotelId', hotel[1]) };
 }
};
for (const host of ['rotavoy.com', 'www.rotavoy.com']) {
 for (const path of paths) {
  const rule = migrationRedirect(host, path);
  assert.equal(rule?.destination, SITE_URL + path, `Missing migration ${host}${path}`);
  assert.equal(rule.permanent, true);
 }
 for (const path of ['/about','/contact','/support','/privacy','/terms','/refund']) assert.equal(migrationRedirect(host, path)?.destination, SITE_URL + path);
 assert.equal(migrationRedirect(host, '/')?.destination, SITE_URL + '/');
 for (const path of ['/travel/checkout','/flights/checkout','/account','/admin','/not-a-page','/google2fd19590f23b16c5.html']) assert.equal(migrationRedirect(host, path), undefined);
 for (const key of ['reference','bookingReference','prebookId','payment_intent','payment_intent_client_secret','redirect_status','transactionId','secretKey','token','sessionId','bookingId','clientSecret','lang','checkin','departure','offerId']) assert.equal(migrationRedirect(host, '/en', `${key}=private`), undefined);
}
for (const host of ['voyhaven.com','www.voyhaven.com','example.vercel.app']) for (const path of paths) assert.equal(migrationRedirect(host, path), undefined);
for (const key of searchKeys) {
 assert.ok(config.headers.some(rule => rule.has.some(match => match.type === 'query' && match.key === key) && rule.headers.some(header => header.key === 'X-Robots-Tag' && header.value.includes('noindex'))));
 assert.ok(appPolicy('/hotels', `${key}=example`, published).noIndex);
}
assert.ok(appPolicy('/privacy', 'lang=tr').title.includes('Gizlilik'));
assert.ok(appPolicy('/privacy', 'lang=de').title.includes('Privacy'));
const existing = hotels[0], provider = { ...existing, main_photo: existing.image };
assert.equal(hotelFactsChanged(existing, provider, existing.source.descriptionHash), false);
for (const [key, value] of Object.entries({ name: 'Updated', address: 'Updated', city: 'Updated', country: 'GB', main_photo: 'https://example.com/new.jpg', stars: 4, latitude: 1, longitude: 1 })) assert.equal(hotelFactsChanged(existing, { ...provider, [key]: value }, existing.source.descriptionHash), true);
assert.equal(hotelFactsChanged(existing, provider, 'changed-description'), true);
for (const [path, search] of [['/flights', 'departure=2099-01-01'], ['/travel/checkout',''], ['/flights/checkout',''], ['/account',''], ['/admin',''], ['/hotels','cityName=Antalya'], ['/travel/hotels/lp55de7','checkin=2099-01-01'], ['/not-a-page',''], ['/en/hotels/not-a-city','']]) assert.ok(appPolicy(path, search, published).noIndex);
assert.equal(appPolicy('/not-a-page', '', published).status, 404);
assert.equal(appPolicy('/travel/hotels/lp55de7', 'lang=tr', published).canonical, SITE_URL + '/tr/travel/hotels/lp55de7');
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
