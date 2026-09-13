const SUPPORTED_CAMPAIGN_LANGUAGES = new Set([
  "en",
  "tr",
  "ru",
  "ar",
  "zh",
  "es",
  "pt",
  "fr",
  "de",
  "it",
]);

export function normalizeCampaignLanguage(value) {
  const language = String(value || "en").trim().toLowerCase();
  return SUPPORTED_CAMPAIGN_LANGUAGES.has(language) ? language : "en";
}

export function getCampaignProductGroupKey(product) {
  const supplierProductId = String(product?.supplierProductId || "").trim();
  if (supplierProductId) return `supplier:${supplierProductId}`;

  return `key:${String(product?.key || "").trim()}`;
}

export function localizeCampaignProduct(product, language = "en") {
  if (!product || typeof product !== "object") return product;

  const safeLanguage = normalizeCampaignLanguage(language);
  const translations = product.translations && typeof product.translations === "object"
    ? product.translations
    : {};
  const localized = translations[safeLanguage];
  const english = translations.en;
  const selected = localized && typeof localized === "object"
    ? localized
    : english && typeof english === "object"
      ? english
      : null;

  if (!selected) return product;

  return {
    ...product,
    title: String(selected.title || product.title || "").trim(),
    description: String(selected.description || product.description || "").trim(),
    categoryLabel: String(selected.categoryLabel || product.categoryLabel || "").trim(),
  };
}

export function pickUniqueCampaignProducts(
  products = [],
  { limit = 3, excludedGroupKeys = [] } = {},
) {
  const safeLimit = Math.max(Number(limit || 0), 0);
  const usedGroupKeys = new Set(excludedGroupKeys);
  const selected = [];

  for (const product of Array.isArray(products) ? products : []) {
    const groupKey = getCampaignProductGroupKey(product);
    if (!groupKey || usedGroupKeys.has(groupKey)) continue;

    usedGroupKeys.add(groupKey);
    selected.push(product);
    if (selected.length >= safeLimit) break;
  }

  return selected;
}
