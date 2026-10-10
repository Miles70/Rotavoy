import { useEffect } from "react";
import { SITE_URL } from "../../../seo/model.js";
function absoluteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, SITE_URL);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeJson(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function Seo({
  title = "VoyHaven Travel | Hotels & Global Stays",
  description = "Search hotels, compare live room offers and book global stays with VoyHaven Travel.",
  path = "/",
  image = "",
  type = "website",
  noIndex = false,
  jsonLd = null,
  alternates = [],
}) {
  const canonicalUrl = absoluteUrl(path || "/");
  const imageUrl = absoluteUrl(image);
  const robots = noIndex
    ? "noindex, follow"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  useEffect(() => {
  const structuredData = Array.isArray(jsonLd)
    ? jsonLd.filter(Boolean)
    : jsonLd
      ? [jsonLd]
      : [];


    // Initial HTTP metadata and SPA transitions share one head. React-only tags
    // must not leave a second canonical or a stale checkout noindex behind.
    const selectors = 'title,meta[name="description"],meta[name="robots"],link[rel="canonical"],link[rel="alternate"][hreflang],meta[property^="og:"],meta[name^="twitter:"],script[type="application/ld+json"]';
    document.head.querySelectorAll(selectors).forEach(node => node.remove());
    const add = (tag, attributes, content) => {
      const node = document.createElement(tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
      if (content) node.textContent = content;
      document.head.appendChild(node);
    };
    add('title', {}, title);
    add('meta', { name: 'description', content: description });
    add('meta', { name: 'robots', content: robots });
    add('link', { rel: 'canonical', href: canonicalUrl });
    alternates.forEach(a => add('link', { rel: 'alternate', hreflang: a.language, href: absoluteUrl(a.path) }));
    for (const [property, content] of Object.entries({ 'og:site_name': 'VoyHaven', 'og:type': type, 'og:title': title, 'og:description': description, 'og:url': canonicalUrl, ...(imageUrl ? { 'og:image': imageUrl } : {}) })) add('meta', { property, content });
    add('meta', { name: 'twitter:card', content: imageUrl ? 'summary_large_image' : 'summary' });
    add('meta', { name: 'twitter:title', content: title });
    add('meta', { name: 'twitter:description', content: description });
    if (imageUrl) add('meta', { name: 'twitter:image', content: imageUrl });
    structuredData.forEach(entry => add('script', { type: 'application/ld+json' }, safeJson(entry)));
  }, [title, description, canonicalUrl, imageUrl, type, robots, alternates, jsonLd]);
  return null;
}

export { SITE_URL };
