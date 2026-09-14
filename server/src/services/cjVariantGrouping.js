const MAX_PRICE_RATIO_PER_GROUP = 2;

function cleanLabel(value) {
  return String(value || "").trim().toLowerCase();
}

function getVariantId(variant) {
  return String(variant?.vid || variant?.variantId || "").trim();
}

function getVariantPrice(variant) {
  const price = Number(variant?.variantSellPrice || 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

export function getCjVariantKind(variant) {
  const label = cleanLabel(
    variant?.variantKey || variant?.variantNameEn || variant?.variantSku,
  );

  const packMatch = label.match(/\b(\d+)\s*(?:pcs?|pieces?|pack|adet)\b/);
  if (packMatch && Number(packMatch[1]) > 1) return `pack-${Number(packMatch[1])}`;
  if (/\btwo\s*(?:pcs?|pieces?|pack)\b|\bx\s*2\b/.test(label)) return "pack-2";
  if (/\b(?:white\s*[-+&/]?\s*pink|beyaz\s*[-+&/]?\s*pembe)\b/.test(label)) {
    return "pack-2-mixed";
  }
  if (/\bset\s*\d*\b/.test(label)) return "set";
  if (/simple packaging|basic packaging|simple package|without box|no box/.test(label)) {
    return "simple-packaging";
  }
  return "standard";
}

export function buildCjVariantGroupMap(variants) {
  const byKind = new Map();

  for (const variant of Array.isArray(variants) ? variants : []) {
    const variantId = getVariantId(variant);
    if (!variantId) continue;
    const kind = getCjVariantKind(variant);
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind).push({ variantId, price: getVariantPrice(variant) });
  }

  const groups = new Map();
  for (const [kind, rows] of byKind) {
    const priced = rows.filter((row) => row.price > 0).sort((a, b) => (
      a.price - b.price || a.variantId.localeCompare(b.variantId)
    ));
    const unpriced = rows.filter((row) => row.price <= 0);
    let band = 0;
    let bandFloor = 0;

    for (const row of priced) {
      if (bandFloor === 0 || row.price / bandFloor > MAX_PRICE_RATIO_PER_GROUP) {
        band += 1;
        bandFloor = row.price;
      }
      groups.set(row.variantId, `${kind}-band-${band}`);
    }

    for (const row of unpriced) {
      groups.set(row.variantId, `${kind}-unpriced`);
    }
  }

  return groups;
}
