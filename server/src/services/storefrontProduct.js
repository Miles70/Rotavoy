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
  const selectedTranslations = {};

  if (localized && typeof localized === "object") {
    selectedTranslations[safeLanguage] = localized;
  }
  if (safeLanguage !== "en" && english && typeof english === "object") {
    selectedTranslations.en = english;
  }

  return {
    ...product,
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
