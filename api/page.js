import { readFile } from 'node:fs/promises';
import { appPolicy } from '../seo/app-policy.js';
import { escapeHtml } from '../seo/html.js';
let assets;
async function loadAssets() {
 assets ||= Promise.all([readFile(new URL('../dist/index.html', import.meta.url), 'utf8'), readFile(new URL('../dist/seo-manifest.json', import.meta.url), 'utf8').then(JSON.parse)]).catch(error => { assets = undefined; throw error; });
 return assets;
}
export default async function handler(request, response) {
 const url = new URL(request.url, 'https://www.rotavoy.com');
 const rawPath = request.query?.path ?? url.searchParams.get('path') ?? url.pathname.replace(/^\//, '');
 const path = '/' + (Array.isArray(rawPath) ? rawPath.join('/') : rawPath);
 url.searchParams.delete('path');
 try {
  const [template, manifest] = await loadAssets();
  const policy = appPolicy(path, url.searchParams.toString(), manifest.hotels);
  if (policy.redirect) { response.setHeader('Location', policy.redirect); response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600'); return response.status(308).end(); }
  const html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(policy.title)}</title>`).replace(/<meta\s+name="description"[\s\S]*?>/i, '').replace(/<link\s+rel="canonical"[\s\S]*?>/i, '').replace('</head>', `<meta name="description" content="${escapeHtml(policy.description)}"><meta name="robots" content="${policy.noIndex ? 'noindex, follow' : 'index, follow'}"><link rel="canonical" href="${escapeHtml(policy.canonical)}"></head>`);
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Query pages may include personal references: never put them into a shared cache.
  response.setHeader('Cache-Control', url.search ? 'private, no-store' : 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  if (policy.noIndex) response.setHeader('X-Robots-Tag', 'noindex, follow');
  return response.status(policy.status).send(html);
 } catch {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Robots-Tag', 'noindex');
  return response.status(503).send('Page temporarily unavailable.');
 }
}
