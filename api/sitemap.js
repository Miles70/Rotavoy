const SITE_URL = "https://rotavoy.com";
const STATIC_PATHS = [
  "/",
  "/categories",
  "/products",
  "/travel",
  "/local",
  "/about",
  "/contact",
  "/support",
  "/privacy",
  "/terms",
  "/refund",
];

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

async function loadProductUrls(apiBaseUrl) {
  if (!apiBaseUrl) return [];

  const response = await fetch(`${apiBaseUrl}/api/products/sitemap`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Product sitemap request failed with ${response.status}`);
  }

  const data = await response.json();
  const products = Array.isArray(data.products) ? data.products : [];

  return products
    .map((product) => {
      const key = String(product?.key || "").trim();
      if (!key) return null;
      return {
        loc: `${SITE_URL}/products/${encodeURIComponent(key)}`,
        lastmod: product?.updatedAt || "",
      };
    })
    .filter(Boolean);
}

export default async function handler(request, response) {
  try {
    const apiBaseUrl = normalizeApiBase(
      process.env.ROTAVOY_API_BASE_URL || process.env.VITE_API_BASE_URL,
    );
    const products = await loadProductUrls(apiBaseUrl);
    const staticUrls = STATIC_PATHS.map((path) => ({ loc: `${SITE_URL}${path}` }));
    const seen = new Set();
    const urls = [...staticUrls, ...products].filter((entry) => {
      if (!entry.loc || seen.has(entry.loc)) return false;
      seen.add(entry.loc);
      return true;
    });

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ loc, lastmod }) => `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod ? `
    <lastmod>${escapeXml(new Date(lastmod).toISOString())}</lastmod>` : ""}
  </url>`,
  )
  .join("\n")}
</urlset>`;

    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    response.status(200).send(body);
  } catch (error) {
    console.error("Sitemap generation failed:", error);
    response.status(500).send("Sitemap generation failed.");
  }
}
