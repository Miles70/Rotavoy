import { readFile, writeFile, rename } from 'node:fs/promises';
import { hotelFactsChanged, publicHotelFacts } from '../seo/hotel-refresh.js';
import { createHash } from 'node:crypto';
// Explicit, sequential catalog maintenance, never run in build or a page request.
const params = new Map(process.argv.slice(2).map(arg => { const i = arg.indexOf('='); return [arg.slice(0, i), arg.slice(i + 1)]; }));
const base = params.get('--api-base');
const ids = (params.get('--ids') || '').split(',').filter(Boolean);
if (!base || !ids.length || ids.length > 25) throw new Error('Usage: npm run seo:refresh -- --api-base=https://your-backend --ids=lp55de7,lp4f7bd (max 25 IDs). Only existing reviewed snapshots are refreshed.');
const url = new URL(base);
if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use an HTTPS backend URL without embedded credentials.');
const statusResponse = await fetch(`${url.origin}/api/hotels/status`, { signal: AbortSignal.timeout(20000) });
const status = await statusResponse.json();
if (!statusResponse.ok || status.environment !== 'production') throw new Error('Production provider status is required; sandbox content cannot be published.');
for (const id of ids) {
 if (!/^lp[a-z0-9]+$/.test(id)) throw new Error('Invalid hotel ID.');
 const path = `seo/hotels/${id}.json`;
 const existing = JSON.parse(await readFile(path, 'utf8'));
 const response = await fetch(`${url.origin}/api/hotels/${id}`, { signal: AbortSignal.timeout(20000) });
 if (!response.ok) throw new Error(`Refresh failed for ${id}: ${response.status}. Existing snapshot retained.`);
 const payload = await response.json();
 const hotel = payload.data?.hotel || payload.data || payload.hotel;
 if (!hotel?.name || (hotel.id && hotel.id !== id)) throw new Error('Incomplete or mismatched provider hotel.');
 const description = String(hotel.description || hotel.hotelDescription || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
 const hash = createHash('sha256').update(description).digest('hex');
 const changed = hotelFactsChanged(existing, hotel, hash);
 const next = { ...existing, ...publicHotelFacts(hotel), deletedAt: hotel.deletedAt || null, source: { provider: 'Nuitee/LiteAPI', environment: 'production', fetchedAt: new Date().toISOString(), description, descriptionHash: hash }, published: changed || hotel.deletedAt ? false : existing.published };
 // Changed facts fail closed; a reviewer must recheck all 10 summaries before publication.
 await writeFile(`${path}.tmp`, JSON.stringify(next, null, 2) + '\n');
 await rename(`${path}.tmp`, path);
 console.log(`${id}: ${changed ? 'description changed; unpublished until translation review' : 'refreshed'}${hotel.deletedAt ? '; provider removed hotel' : ''}`);
}
