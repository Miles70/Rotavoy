const SITE_URL = "https://rotavoy.com";
const CATEGORIES = {
  electronics: { key: "electronics", name: "Electronics", description: "Shop phones, computers, smart devices, gaming technology and electronics on Rotavoy." },
  fashion: { key: "fashion", name: "Fashion", description: "Shop clothing, shoes, accessories and everyday fashion on Rotavoy." },
  "home-living-office": { key: "homeLivingOffice", name: "Home, Living, Stationery & Office", description: "Shop home essentials, appliances, stationery and office products on Rotavoy." },
  "auto-garden-diy": { key: "autoGardenTools", name: "Auto, Garden & DIY", description: "Shop automotive products, tools, repair, garden and outdoor essentials on Rotavoy." },
  "mother-baby-toys": { key: "motherBabyToys", name: "Mother, Baby & Toys", description: "Shop baby care, family essentials, toys and games on Rotavoy." },
  "sports-outdoor": { key: "sportsOutdoor", name: "Sports & Outdoor", description: "Shop fitness, training, outdoor and sports equipment on Rotavoy." },
  "beauty-personal-care": { key: "beautyCare", name: "Beauty & Personal Care", description: "Shop cosmetics, skincare, grooming and personal care products on Rotavoy." },
  "supermarket-pets": { key: "supermarketPets", name: "Supermarket & Pet Shop", description: "Shop everyday essentials and pet products on Rotavoy." },
  "books-music-film-hobby": { key: "booksMusicFilmHobby", name: "Books, Music, Film & Hobby", description: "Shop entertainment, gaming, collecting and hobby products on Rotavoy." },
};
const LEGACY_SLUGS = Object.fromEntries(Object.entries(CATEGORIES).map(([slug, category]) => [category.key, slug]));

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function apiBaseUrl() {
  return String(process.env.ROTAVOY_API_BASE_URL || process.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
}

function pagePath(slug, page) {
  return `/category/${slug}${page > 1 ? `?page=${page}` : ""}`;
}

async function loadShell(request) {
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const shellResponse = await fetch(`${protocol}://${host}/index.html`);
  if (!shellResponse.ok) throw new Error(`HTML shell request failed with ${shellResponse.status}`);
  return shellResponse.text();
}

function renderProducts(products) {
  if (!products.length) return "<p>No products are currently available in this collection.</p>";
  return `<section><h2>Products</h2><ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;padding:0;list-style:none">${products.map((product) => {
    const url = `/products/${encodeURIComponent(product.key)}`;
    const image = product.imageUrl || product.images?.[0] || "";
    return `<li><article><a href="${url}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.title)}" width="360" height="360" loading="lazy">` : ""}<h3>${escapeHtml(product.title)}</h3></a></article></li>`;
  }).join("")}</ul></section>`;
}

function renderPagination(slug, pagination) {
  if (pagination.totalPages <= 1) return "";
  const links = [];
  if (pagination.hasPreviousPage) links.push(`<a href="${pagePath(slug, pagination.page - 1)}">Previous</a>`);
  if (pagination.hasNextPage) links.push(`<a href="${pagePath(slug, pagination.page + 1)}">Next</a>`);
  return `<nav aria-label="Product pages" style="display:flex;gap:20px;margin-top:32px">${links.join("")}</nav>`;
}

export default async function handler(request, response) {
  const requestedSlug = String(request.query.groupKey || "").trim();
  const legacyTarget = LEGACY_SLUGS[requestedSlug];
  const requestedPage = Math.max(Number.parseInt(request.query.page, 10) || 1, 1);

  if (legacyTarget && legacyTarget !== requestedSlug) {
    response.setHeader("Location", pagePath(legacyTarget, requestedPage));
    return response.status(308).send("Permanent Redirect");
  }

  try {
    const category = CATEGORIES[requestedSlug];
    const baseUrl = apiBaseUrl();
    const shell = await loadShell(request);
    if (!category) {
      const html = shell.replace("</head>", '<meta data-seo-server="true" name="robots" content="noindex, follow">\n</head>');
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      return response.status(404).send(html);
    }
    if (!baseUrl) throw new Error("Category page configuration is incomplete.");

    const productResponse = await fetch(`${baseUrl}/api/products?group=${encodeURIComponent(category.key)}&page=${requestedPage}&limit=24&language=en&recommendations=0`, { headers: { accept: "application/json" } });
    if (!productResponse.ok) throw new Error(`Category products request failed with ${productResponse.status}`);
    const data = await productResponse.json();
    const products = Array.isArray(data.products) ? data.products : [];
    const pagination = data.pagination || { page: requestedPage, totalPages: 1, hasPreviousPage: false, hasNextPage: false };
    if (pagination.page !== requestedPage) {
      response.setHeader("Location", pagePath(requestedSlug, pagination.page));
      return response.status(308).send("Permanent Redirect");
    }

    const path = pagePath(requestedSlug, pagination.page);
    const url = `${SITE_URL}${path}`;
    const pageSuffix = pagination.page > 1 ? ` - Page ${pagination.page}` : "";
    const title = `${category.name} Products${pageSuffix} | Rotavoy`;
    const itemList = products.map((product, index) => ({ "@type": "ListItem", position: (pagination.page - 1) * 24 + index + 1, url: `${SITE_URL}/products/${encodeURIComponent(product.key)}`, name: product.title }));
    const jsonLd = { "@context": "https://schema.org", "@graph": [
      { "@type": "CollectionPage", name: category.name, description: category.description, url, mainEntity: { "@type": "ItemList", itemListElement: itemList } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Rotavoy", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: category.name, item: `${SITE_URL}/category/${requestedSlug}` },
      ] },
    ] };
    const metadata = `<title data-seo-server="true">${escapeHtml(title)}</title>
<meta data-seo-server="true" name="description" content="${escapeHtml(category.description)}">
<meta data-seo-server="true" name="robots" content="index, follow, max-image-preview:large">
<link data-seo-server="true" rel="canonical" href="${escapeHtml(url)}">
<meta data-seo-server="true" property="og:site_name" content="Rotavoy">
<meta data-seo-server="true" property="og:type" content="website">
<meta data-seo-server="true" property="og:title" content="${escapeHtml(title)}">
<meta data-seo-server="true" property="og:description" content="${escapeHtml(category.description)}">
<meta data-seo-server="true" property="og:url" content="${escapeHtml(url)}">
<script data-seo-server="true" type="application/ld+json">${safeJson(jsonLd)}</script>`;
    const html = shell.replace(/<title>[\s\S]*?<\/title>/i, "").replace("</head>", `${metadata}\n</head>`).replace('<div id="root"></div>', `<div id="root"><main style="max-width:1200px;margin:40px auto;padding:24px;font-family:system-ui,sans-serif"><nav><a href="/">Rotavoy</a> / <a href="/categories">Categories</a></nav><h1>${escapeHtml(category.name)}${pageSuffix}</h1><p>${escapeHtml(category.description)}</p>${renderProducts(products)}${renderPagination(requestedSlug, pagination)}</main></div>`);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    return response.status(200).send(html);
  } catch (error) {
    console.error("Category page rendering failed:", error);
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Retry-After", "300");
    return response.status(503).send("Category page is temporarily unavailable.");
  }
}
