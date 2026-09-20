const SITE_URL = "https://rotavoy.com";
const CATEGORIES = {
  electronics: ["Electronics", "Shop phones, computers, smart devices, gaming technology and electronics on Rotavoy."],
  fashion: ["Fashion", "Shop clothing, shoes, accessories and everyday fashion on Rotavoy."],
  homeLivingOffice: ["Home, Living, Stationery & Office", "Shop home essentials, appliances, stationery and office products on Rotavoy."],
  autoGardenTools: ["Auto, Garden & DIY", "Shop automotive products, tools, repair, garden and outdoor essentials on Rotavoy."],
  motherBabyToys: ["Mother, Baby & Toys", "Shop baby care, family essentials, toys and games on Rotavoy."],
  sportsOutdoor: ["Sports & Outdoor", "Shop fitness, training, outdoor and sports equipment on Rotavoy."],
  beautyCare: ["Beauty & Personal Care", "Shop cosmetics, skincare, grooming and personal care products on Rotavoy."],
  supermarketPets: ["Supermarket & Pet Shop", "Shop everyday essentials and pet products on Rotavoy."],
  booksMusicFilmHobby: ["Books, Music, Film & Hobby", "Shop entertainment, gaming, collecting and hobby products on Rotavoy."],
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadShell(request) {
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const shellResponse = await fetch(`${protocol}://${host}/index.html`);
  if (!shellResponse.ok) throw new Error(`HTML shell request failed with ${shellResponse.status}`);
  return shellResponse.text();
}

export default async function handler(request, response) {
  try {
    const groupKey = String(request.query.groupKey || "").trim();
    const category = CATEGORIES[groupKey];
    const shell = await loadShell(request);

    if (!category) {
      const html = shell.replace("</head>", '<meta data-seo-server="true" name="robots" content="noindex, follow">\n</head>');
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      return response.status(404).send(html);
    }

    const [name, description] = category;
    const url = `${SITE_URL}/category/${groupKey}`;
    const title = `${name} Products | Rotavoy`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "CollectionPage", name, description, url },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Rotavoy", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name, item: url },
          ],
        },
      ],
    };
    const metadata = `<title data-seo-server="true">${escapeHtml(title)}</title>
<meta data-seo-server="true" name="description" content="${escapeHtml(description)}">
<meta data-seo-server="true" name="robots" content="index, follow, max-image-preview:large">
<link data-seo-server="true" rel="canonical" href="${escapeHtml(url)}">
<meta data-seo-server="true" property="og:site_name" content="Rotavoy">
<meta data-seo-server="true" property="og:type" content="website">
<meta data-seo-server="true" property="og:title" content="${escapeHtml(title)}">
<meta data-seo-server="true" property="og:description" content="${escapeHtml(description)}">
<meta data-seo-server="true" property="og:url" content="${escapeHtml(url)}">
<script data-seo-server="true" type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`;
    const html = shell
      .replace(/<title>[\s\S]*?<\/title>/i, "")
      .replace("</head>", `${metadata}\n</head>`)
      .replace('<div id="root"></div>', `<div id="root"><main style="max-width:1200px;margin:40px auto;padding:24px;font-family:system-ui,sans-serif"><nav><a href="/">Rotavoy</a> / Categories</nav><h1>${escapeHtml(name)}</h1><p>${escapeHtml(description)}</p><p><a href="/category/${escapeHtml(groupKey)}">Explore ${escapeHtml(name)}</a></p></main></div>`);

    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return response.status(200).send(html);
  } catch (error) {
    console.error("Category page rendering failed:", error);
    return response.status(500).send("Category page rendering failed.");
  }
}
