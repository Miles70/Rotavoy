const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const supportedProductLanguages = [
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
];

const numberLocales = {
  en: "en-US",
  tr: "tr-TR",
  ru: "ru-RU",
  ar: "ar-SA",
  zh: "zh-CN",
  es: "es-ES",
  pt: "pt-BR",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
};

const detailLabels = {
  en: {
    supplier: "Supplier",
    variant: "Variant",
    sku: "SKU",
    originCountry: "Country of origin",
    weightGrams: "Weight",
  },
  tr: {
    supplier: "Tedarikçi",
    variant: "Varyant",
    sku: "SKU",
    originCountry: "Menşei",
    weightGrams: "Ağırlık",
  },
  ru: {
    supplier: "Поставщик",
    variant: "Вариант",
    sku: "Артикул",
    originCountry: "Страна происхождения",
    weightGrams: "Вес",
  },
  ar: {
    supplier: "المورّد",
    variant: "الخيار",
    sku: "SKU",
    originCountry: "بلد المنشأ",
    weightGrams: "الوزن",
  },
  zh: {
    supplier: "供应商",
    variant: "规格",
    sku: "SKU",
    originCountry: "原产国",
    weightGrams: "重量",
  },
  es: {
    supplier: "Proveedor",
    variant: "Variante",
    sku: "SKU",
    originCountry: "País de origen",
    weightGrams: "Peso",
  },
  pt: {
    supplier: "Fornecedor",
    variant: "Variante",
    sku: "SKU",
    originCountry: "País de origem",
    weightGrams: "Peso",
  },
  fr: {
    supplier: "Fournisseur",
    variant: "Variante",
    sku: "SKU",
    originCountry: "Pays d'origine",
    weightGrams: "Poids",
  },
  de: {
    supplier: "Lieferant",
    variant: "Variante",
    sku: "SKU",
    originCountry: "Herkunftsland",
    weightGrams: "Gewicht",
  },
  it: {
    supplier: "Fornitore",
    variant: "Variante",
    sku: "SKU",
    originCountry: "Paese di origine",
    weightGrams: "Peso",
  },
};

function normalizeLanguage(value) {
  const language = String(value || "en").toLowerCase();
  return supportedProductLanguages.includes(language) ? language : "en";
}

function getProductTranslation(product, language) {
  const translations = product?.translations;
  if (!translations || typeof translations !== "object") return null;

  const localized = translations[language];
  if (localized && typeof localized === "object") return localized;

  const english = translations.en;
  return english && typeof english === "object" ? english : null;
}

function humanizeDetailKey(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function localizeCountryCode(countryCode, language) {
  const code = String(countryCode || "").trim().toUpperCase();
  if (!code) return "";

  try {
    if (typeof Intl?.DisplayNames !== "function") return code;
    const displayNames = new Intl.DisplayNames([numberLocales[language] || "en-US"], {
      type: "region",
    });
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

function localizeDetails(product, language, translation) {
  const details = product?.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return details || {};

  const labels = detailLabels[language] || detailLabels.en;
  const locale = numberLocales[language] || numberLocales.en;
  const localized = {};

  for (const [key, rawValue] of Object.entries(details)) {
    if (rawValue === "" || rawValue === null || rawValue === undefined) continue;

    const label = labels[key] || humanizeDetailKey(key);
    let value = rawValue;

    if (key === "variant" && translation?.variant) {
      value = translation.variant;
    } else if (key === "originCountry") {
      value = localizeCountryCode(rawValue, language);
    } else if (key === "weightGrams") {
      const grams = Number(rawValue || 0);
      value = `${Number.isFinite(grams) ? grams.toLocaleString(locale) : rawValue} g`;
    }

    localized[label] = value;
  }

  return localized;
}

export function normalizeProduct(product, requestedLanguage = "en") {
  if (!product) return product;

  const language = normalizeLanguage(requestedLanguage);
  const translation = getProductTranslation(product, language);
  const localizedFeatures = Array.isArray(translation?.features)
    ? translation.features.filter(Boolean)
    : product.features;

  return {
    ...product,
    title: translation?.title || product.title || "",
    description: translation?.description || product.description || "",
    categoryLabel: translation?.categoryLabel || product.categoryLabel || "",
    features: Array.isArray(localizedFeatures) ? localizedFeatures : [],
    details: localizeDetails(product, language, translation),
    imageUrl: product.imageUrl || product.images?.[0] || "",
  };
}

async function storeRequest(path) {
  const response = await fetch(`${apiBaseUrl}/api${path}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Product request failed.");
  }

  return data;
}

export async function getStoreProducts({
  page = 1,
  limit = 24,
  search = "",
  category = "",
  group = "",
  sort = "popular",
  language = "en",
} = {}) {
  const normalizedLanguage = normalizeLanguage(language);
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort,
    language: normalizedLanguage,
  });

  if (search) query.set("search", search);
  if (category) query.set("category", category);
  if (group) query.set("group", group);

  const data = await storeRequest(`/products?${query.toString()}`);

  return {
    ...data,
    products: (data.products || []).map((product) => normalizeProduct(product, normalizedLanguage)),
  };
}

export async function getStoreProduct(productKey, language = "en") {
  const normalizedLanguage = normalizeLanguage(language);
  const query = new URLSearchParams({ language: normalizedLanguage });
  const data = await storeRequest(`/products/${encodeURIComponent(productKey)}?${query.toString()}`);

  return {
    ...data,
    product: normalizeProduct(data.product, normalizedLanguage),
  };
}
