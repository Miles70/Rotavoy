import { SITE_URL, structuredData } from './model.js';
export const escapeHtml = value => String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export const safeJson = value => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
export function head(page) {
 const title = escapeHtml(`${page.title} | VoyHaven`), description = escapeHtml(page.description.slice(0, 300));
 const url = SITE_URL + page.path;
 return `<title>${title}</title><meta name="description" content="${description}"><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${url}">${page.alternates.map(a => `<link rel="alternate" hreflang="${a.language}" href="${SITE_URL}${a.path}">`).join('')}<meta property="og:site_name" content="VoyHaven"><meta property="og:type" content="website"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}">${page.hotel?.image ? `<meta property="og:image" content="${escapeHtml(page.hotel.image)}">` : ''}<meta name="twitter:card" content="${page.hotel ? 'summary_large_image' : 'summary'}"><script type="application/ld+json">${safeJson(structuredData(page))}</script>`;
}
export function renderDocument(template, page, content) {
 return template.replace('<html lang="en">', `<html lang="${page.lang}" dir="${page.lang === 'ar' ? 'rtl' : 'ltr'}">`).replace('<!--seo-head-->', head(page)).replace('<!--seo-content-->', content).replace('<!--seo-data-->', `<script id="seo-page-data" type="application/json">${safeJson(page)}</script>`);
}
