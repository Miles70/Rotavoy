import { SITE_URL } from './travelSeo.js';
export function absoluteUrl(value) {
  try { const url = new URL(String(value || '/'), SITE_URL); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''; } catch { return ''; }
}
export function seoHeadEntries({ title = 'Rotavoy Travel | Hotels & Global Stays', description = 'Search hotels, compare room offers and book global stays with Rotavoy Travel.', path = '/', image = '', type = 'website', noIndex = false, jsonLd = null, alternates = [] } = {}) {
  const canonical = absoluteUrl(path);
  const imageUrl = image ? absoluteUrl(image) : '';
  const meta = (name, content, property = false) => ['meta', { [property ? 'property' : 'name']: name, content }];
  const entries = [['title', {}, title], meta('description', description), meta('robots', noIndex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'), ['link', { rel: 'canonical', href: canonical }], ...alternates.map(item => ['link', { rel: 'alternate', hreflang: item.language, href: absoluteUrl(item.path) }]), meta('og:site_name', 'Rotavoy', true), meta('og:type', type, true), meta('og:title', title, true), meta('og:description', description, true), meta('og:url', canonical, true), meta('twitter:card', imageUrl ? 'summary_large_image' : 'summary'), meta('twitter:title', title), meta('twitter:description', description)];
  if (imageUrl) entries.push(meta('og:image', imageUrl, true), meta('twitter:image', imageUrl));
  const data = Array.isArray(jsonLd) ? jsonLd.filter(Boolean) : jsonLd ? [jsonLd] : [];
  for (const item of data) entries.push(['script', { type: 'application/ld+json' }, JSON.stringify(item).replace(/</g, '\\u003c')]);
  return entries;
}
export const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export function seoHeadHtml(props) {
  return seoHeadEntries(props).map(([tag, attrs, content = '']) => {
    const attributes = Object.entries(attrs).map(([key, value]) => ` ${key}="${escapeHtml(value)}"`).join('');
    return `<${tag} data-rv-seo="true"${attributes}>${['meta', 'link'].includes(tag) ? '' : `${tag === 'script' ? content : escapeHtml(content)}</${tag}>`}`;
  }).join('\n');
}
