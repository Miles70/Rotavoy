const SITE_URL = "https://rotavoy.com";
const STATIC_PATHS = [
  "/",
  "/travel",
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

export default function handler(request, response) {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${STATIC_PATHS.map(
    (path) => `  <url>
    <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>
  </url>`,
  ).join("\n")}
</urlset>`;

  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  response.status(200).send(body);
}
