const SITE_URL = "https://rotavoy.com";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function plainText(value, maxLength = 160) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function apiBaseUrl() {
  return String(process.env.ROTAVOY_API_BASE_URL || process.env.VITE_API_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");
}

async function loadShell(request) {
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const response = await fetch(`${protocol}://${host}/index.html`);
  if (!response.ok) throw new Error(`HTML shell request failed with ${response.status}`);
  return response.text();
}

function replaceHead(html, metadata) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace("</head>", `${metadata}\n  </head>`);
}

function renderProductContent(product, description, image) {
  return `<main style="max-width:1200px;margin:40px auto;padding:24px;font-family:system-ui,sans-serif">
    <nav><a href="/">Rotavoy</a> / <a href="/products">Products</a></nav>
    <article>
      <h1>${escapeHtml(product.title)}</h1>
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.title)}" width="720" height="720">` : ""}
      <p>${escapeHtml(description)}</p>
      <p><strong>${escapeHtml(product.currency || "USD")} ${escapeHtml(Number(product.price || 0).toFixed(2))}</strong></p>
      <p>${Number(product.stock || 0) > 0 ? "In stock" : "Out of stock"}</p>
    </article>
  </main>`;
}

export default async function handler(request, response) {
  const productKey = String(request.query.productKey || "").trim();
  const baseUrl = apiBaseUrl();

  try {
    if (!productKey || !baseUrl) throw new Error("Product page configuration is incomplete.");

    const [shell, productResponse] = await Promise.all([
      loadShell(request),
      fetch(`${baseUrl}/api/products/${encodeURIComponent(productKey)}?language=en`, {
        headers: { accept: "application/json" },
      }),
    ]);

    if (productResponse.status === 404) {
      const noIndexShell = replaceHead(shell, '<title data-seo-server="true">Product Not Found | Rotavoy</title>\n<meta data-seo-server="true" name="robots" content="noindex, follow">');
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      return response.status(404).send(noIndexShell);
    }
    if (!productResponse.ok) throw new Error(`Product request failed with ${productResponse.status}`);

    const data = await productResponse.json();
    const product = data.product;
    const productUrl = `${SITE_URL}/products/${encodeURIComponent(product.key)}`;
    const description = plainText(product.description || `Shop ${product.title} on Rotavoy.`);
    const image = product.imageUrl || product.images?.[0] || "";
    const title = `${plainText(product.title, 110)} | Rotavoy`;
    const inStock = Number(product.stock || 0) > 0;
    const structuredData = [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.title,
        description,
        sku: product.key,
        image: [...new Set([...(product.images || []), product.imageUrl].filter(Boolean))],
        offers: {
          "@type": "Offer",
          url: productUrl,
          priceCurrency: product.currency || "USD",
          price: Number(product.price || 0).toFixed(2),
          availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@type": "Organization", name: "Rotavoy" },
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Rotavoy", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Products", item: `${SITE_URL}/products` },
          { "@type": "ListItem", position: 3, name: product.title, item: productUrl },
        ],
      },
    ];
    const metadata = `<title data-seo-server="true">${escapeHtml(title)}</title>
<meta data-seo-server="true" name="description" content="${escapeHtml(description)}">
<meta data-seo-server="true" name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<link data-seo-server="true" rel="canonical" href="${escapeHtml(productUrl)}">
<meta data-seo-server="true" property="og:site_name" content="Rotavoy">
<meta data-seo-server="true" property="og:type" content="product">
<meta data-seo-server="true" property="og:title" content="${escapeHtml(title)}">
<meta data-seo-server="true" property="og:description" content="${escapeHtml(description)}">
<meta data-seo-server="true" property="og:url" content="${escapeHtml(productUrl)}">
${image ? `<meta data-seo-server="true" property="og:image" content="${escapeHtml(image)}">` : ""}
<meta data-seo-server="true" name="twitter:card" content="summary_large_image">
<script data-seo-server="true" type="application/ld+json">${safeJson(structuredData)}</script>`;

    const html = replaceHead(shell, metadata).replace(
      '<div id="root"></div>',
      `<div id="root">${renderProductContent(product, description, image)}</div>`,
    );
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    return response.status(200).send(html);
  } catch (error) {
    console.error("Product page rendering failed:", error);
    try {
      const shell = await loadShell(request);
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      return response.status(200).send(shell);
    } catch {
      return response.status(500).send("Product page rendering failed.");
    }
  }
}
