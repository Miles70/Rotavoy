const SUPPORTED_PRODUCT_LANGUAGES = new Set([
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

const STOREFRONT_PRIVATE_FIELD_NAMES = [
  "costPrice",
  "supplierContent",
  "contentMeta",
  "translationMeta",
  "sourceHash",
  "sourceCode",
  "sourceUrl",
  "supplierVariantId",
  "supplierSku",
];

export const STOREFRONT_PRIVATE_FIELDS = STOREFRONT_PRIVATE_FIELD_NAMES
  .map((field) => `-${field}`)
  .join(" ");

export function normalizeStorefrontLanguage(value) {
  const language = String(value || "en").trim().toLowerCase();
  return SUPPORTED_PRODUCT_LANGUAGES.has(language) ? language : "en";
}

export function getLocalizedSearchFields(language) {
  const safeLanguage = normalizeStorefrontLanguage(language);
  return [
    `translations.${safeLanguage}.title`,
    `translations.${safeLanguage}.description`,
    `translations.${safeLanguage}.categoryLabel`,
    `translations.${safeLanguage}.variant`,
    `translations.${safeLanguage}.features`,
  ];
}

export function sanitizeStorefrontProduct(product) {
  if (!product || typeof product !== "object") return product;

  const sanitized = { ...product };
  for (const field of STOREFRONT_PRIVATE_FIELD_NAMES) {
    delete sanitized[field];
  }
  return sanitized;
}

export function trimStorefrontTranslations(product, language) {
  if (!product || typeof product !== "object") return product;

  const safeLanguage = normalizeStorefrontLanguage(language);
  const translations = product.translations && typeof product.translations === "object"
    ? product.translations
    : {};
  const localized = translations[safeLanguage];
  const english = translations.en;
  const activeTranslation = localized && typeof localized === "object"
    ? localized
    : english && typeof english === "object"
      ? english
      : null;
  const selectedTranslations = {};

  if (localized && typeof localized === "object") {
    selectedTranslations[safeLanguage] = localized;
  }
  if (safeLanguage !== "en" && english && typeof english === "object") {
    selectedTranslations.en = english;
  }

  return {
    ...product,
    ...(activeTranslation?.title ? { title: activeTranslation.title } : {}),
    ...(activeTranslation?.description ? { description: activeTranslation.description } : {}),
    ...(activeTranslation?.categoryLabel ? { categoryLabel: activeTranslation.categoryLabel } : {}),
    ...(Array.isArray(activeTranslation?.features)
      ? { features: activeTranslation.features }
      : {}),
    translations: selectedTranslations,
  };
}

export function buildGroupedStorefrontProduct(group, language) {
  const product = sanitizeStorefrontProduct(group?.product || {});
  const variantCount = Math.max(Number(group?.variantCount || 1), 1);
  const priceMin = Number(group?.priceMin ?? product.price ?? 0);
  const priceMax = Number(group?.priceMax ?? product.price ?? 0);
  const stock = Math.max(Number(group?.stockTotal ?? product.stock ?? 0), 0);

  return {
    ...trimStorefrontTranslations(product, language),
    variantCount,
    priceMin,
    priceMax,
    stock,
  };
}

function compareCatalogRepresentatives(left, right) {
  return Number(left.price || 0) - Number(right.price || 0) ||
    String(left.key || "").localeCompare(String(right.key || ""));
}

export function buildCatalogGroupSummaries(rows, sortMode = "popular") {
  const groups = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const groupKey = String(row?.supplierProductId || row?.key || "").trim();
    if (!groupKey) continue;

    const price = Number(row?.price || 0);
    const stock = Math.max(Number(row?.stock || 0), 0);
    const existing = groups.get(groupKey);

    if (!existing) {
      groups.set(groupKey, {
        groupKey,
        representative: row,
        variantCount: 1,
        priceMin: price,
        priceMax: price,
        stockTotal: stock,
        hasVideo: Boolean(row?.hasVideo),
      });
      continue;
    }

    existing.variantCount += 1;
    existing.priceMin = Math.min(existing.priceMin, price);
    existing.priceMax = Math.max(existing.priceMax, price);
    existing.stockTotal += stock;
    existing.hasVideo = existing.hasVideo || Boolean(row?.hasVideo);
    if (compareCatalogRepresentatives(row, existing.representative) < 0) {
      existing.representative = row;
    }
  }

  return [...groups.values()].sort((left, right) => {
    const leftProduct = left.representative;
    const rightProduct = right.representative;
    const createdDifference = new Date(rightProduct?.createdAt || 0).getTime() -
      new Date(leftProduct?.createdAt || 0).getTime();

    if (sortMode === "newest") {
      return createdDifference || String(leftProduct?.key || "").localeCompare(String(rightProduct?.key || ""));
    }

    const videoDifference = Number(Boolean(right.hasVideo)) - Number(Boolean(left.hasVideo));

    return videoDifference ||
      Number(rightProduct?.popularity || 0) - Number(leftProduct?.popularity || 0) ||
      createdDifference ||
      String(leftProduct?.key || "").localeCompare(String(rightProduct?.key || ""));
  });
}
