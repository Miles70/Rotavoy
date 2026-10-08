import { SITE_URL, TRAVEL_LANDINGS, travelAlternates } from '../shared/travelSeo.js';
const staticPaths = ['/', '/about', '/contact', '/support', '/privacy', '/terms', '/refund'];
const escapeXml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
export function sitemapXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${[...staticPaths.map(path => ({ path })), ...TRAVEL_LANDINGS].map(page => `  <url><loc>${escapeXml(SITE_URL + page.path)}</loc>${page.category ? travelAlternates(page.category).map(alt => `<xhtml:link rel="alternate" hreflang="${escapeXml(alt.language)}" href="${escapeXml(SITE_URL + alt.path)}" />`).join('') : ''}</url>`).join('\n')}\n</urlset>`;
}
export default function handler(request, response) {
  response.setHeader('Content-Type', 'application/xml; charset=utf-8');
  response.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  response.status(200).send(sitemapXml());
}
