const SITE_URL = "https://rotavoy.com";

function absoluteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw, SITE_URL).toString();
  } catch {
    return "";
  }
}

function safeJson(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function Seo({
  title = "Rotavoy | Global Marketplace",
  description = "Discover electronics, fashion, home, lifestyle and more on Rotavoy.",
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
  const structuredData = Array.isArray(jsonLd)
    ? jsonLd.filter(Boolean)
    : jsonLd
      ? [jsonLd]
      : [];

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={canonicalUrl} />
      {alternates.map(({ language, path: alternatePath }) => (
        <link
          key={`${language}-${alternatePath}`}
          rel="alternate"
          hrefLang={language}
          href={absoluteUrl(alternatePath)}
        />
      ))}

      <meta property="og:site_name" content="Rotavoy" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      {imageUrl ? <meta property="og:image" content={imageUrl} /> : null}

      <meta name="twitter:card" content={imageUrl ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {imageUrl ? <meta name="twitter:image" content={imageUrl} /> : null}

      {structuredData.map((entry, index) => (
        <script
          key={`seo-jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJson(entry) }}
        />
      ))}
    </>
  );
}

export { SITE_URL };
