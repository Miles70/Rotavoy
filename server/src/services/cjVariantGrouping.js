function cleanLabel(value) {
  return String(value || "").trim().toLowerCase();
}

function getVariantId(variant) {
  return String(variant?.vid || variant?.variantId || "").trim();
}

function getAccessoryKind(label, productTitle) {
  const accessoryMatchers = [
    ["filter", /\b(?:replacement\s+)?filters?\b/],
    ["brush", /\b(?:replacement\s+)?brush(?:es)?\b/],
    ["refill", /\brefills?\b/],
    ["spare", /\bspare\b/],
    ["replacement", /\breplacement\b/],
    ["accessory", /\baccessor(?:y|ies)\b/],
    ["strap", /\b(?:replacement\s+)?strap\b/],
    ["charger", /\bcharger\b/],
    ["cable", /\bcable\b/],
    ["adapter", /\badapter\b/],
    ["blade", /\b(?:replacement\s+)?blades?\b/],
    ["head", /\b(?:replacement\s+)?heads?\b/],
  ];

  for (const [kind, pattern] of accessoryMatchers) {
    if (!pattern.test(label)) continue;

    // If the parent product itself is this item type, it is not an accessory.
    if (pattern.test(productTitle)) continue;

    return `accessory-${kind}`;
  }

  return "";
}

export function getCjVariantKind(variant, productTitle = "") {
  const label = cleanLabel(
    variant?.variantKey || variant?.variantNameEn || variant?.variantSku,
  );
  const cleanProductTitle = cleanLabel(productTitle);

  const accessoryKind = getAccessoryKind(label, cleanProductTitle);
  if (accessoryKind) return accessoryKind;

  const packMatch = label.match(/\b(\d+)\s*(?:pcs?|pieces?|pack|adet)\b/);
  if (packMatch && Number(packMatch[1]) > 1) {
    return `pack-${Number(packMatch[1])}`;
  }

  if (/\btwo\s*(?:pcs?|pieces?|pack)\b|\bx\s*2\b/.test(label)) {
    return "pack-2";
  }

  if (/\b(?:white\s*[-+&/]?\s*pink|beyaz\s*[-+&/]?\s*pembe)\b/.test(label)) {
    return "pack-2-mixed";
  }

  if (/\bset\s*\d*\b/.test(label)) return "set";

  if (/simple packaging|basic packaging|simple package|without box|no box/.test(label)) {
    return "simple-packaging";
  }

  return "standard";
}

export function buildCjVariantGroupMap(
  variants,
  { productTitle = "" } = {},
) {
  const groups = new Map();

  for (const variant of Array.isArray(variants) ? variants : []) {
    const variantId = getVariantId(variant);
    if (!variantId) continue;

    const kind = getCjVariantKind(variant, productTitle);

    // Sizes, colors, capacities, normal packs, sets and packaging choices
    // are one customer-facing product. Supplier price differences never
    // create additional catalog cards.
    const groupKey = kind.startsWith("accessory-")
      ? kind
      : "product";

    groups.set(variantId, groupKey);
  }

  return groups;
}
