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

export const STOREFRONT_PRODUCT_LANGUAGES = [...SUPPORTED_PRODUCT_LANGUAGES];

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

export function getAllLocalizedSearchFields() {
  return STOREFRONT_PRODUCT_LANGUAGES.flatMap((language) =>
    getLocalizedSearchFields(language),
  );
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

function getCatalogGroupKey(row) {
  const supplierProductId = String(row?.supplierProductId || "").trim();
  return supplierProductId || String(row?.key || "").trim();
}

function compareCatalogRepresentatives(left, right) {
  const stockDifference =
    Number(Number(right?.stock || 0) > 0) - Number(Number(left?.stock || 0) > 0);

  return stockDifference ||
    Number(left.price || 0) - Number(right.price || 0) ||
    String(left.key || "").localeCompare(String(right.key || ""));
}

export function buildCatalogGroupSummaries(rows, sortMode = "popular") {
  const groups = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const groupKey = getCatalogGroupKey(row);
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
        inStock: stock > 0,
        hasVideo: Boolean(row?.hasVideo),
      });
      continue;
    }

    existing.variantCount += 1;
    existing.priceMin = Math.min(existing.priceMin, price);
    existing.priceMax = Math.max(existing.priceMax, price);
    existing.stockTotal += stock;
    existing.inStock = existing.inStock || stock > 0;
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

    const stockDifference = Number(Boolean(right.inStock)) - Number(Boolean(left.inStock));
    const videoDifference = Number(Boolean(right.hasVideo)) - Number(Boolean(left.hasVideo));

    return stockDifference ||
      videoDifference ||
      Number(rightProduct?.popularity || 0) - Number(leftProduct?.popularity || 0) ||
      createdDifference ||
      String(leftProduct?.key || "").localeCompare(String(rightProduct?.key || ""));
  });
}

const SHOWCASE_CATEGORY_BONUS = Object.freeze({
  appliances: 36,
  home: 32,
  electronics: 30,
  tools: 26,
  automotive: 24,
  office: 18,
  sports: 16,
  pets: 14,
  beauty: 12,
  baby: 10,
  grocery: 8,
  fashion: 6,
  toys: 5,
  hobby: 3,
  gaming: 2,
});

const SHOWCASE_IGNORED_TITLE_TOKENS = new Set([
  "with", "from", "this", "that", "for", "and", "the", "new", "hot", "sale",
  "fashion", "style", "stylish", "casual", "premium", "high", "quality", "latest",
  "portable", "mini", "small", "large", "extra", "plus", "size", "sizes",
  "black", "white", "red", "blue", "green", "pink", "purple", "yellow", "gray",
  "grey", "brown", "beige", "gold", "silver", "women", "womens", "woman",
  "men", "mens", "male", "female", "girl", "girls", "boy", "boys", "adult",
  "piece", "pieces", "pack", "set", "pcs", "pc", "model", "version",
]);

function normalizeShowcaseToken(token) {
  const value = String(token || "").toLocaleLowerCase("en-US");
  if (value.length > 4 && value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.length > 4 && value.endsWith("s") && !value.endsWith("ss")) return value.slice(0, -1);
  return value;
}

function showcaseTitleTokens(value) {
  return [...new Set(
    String(value || "")
      .toLocaleLowerCase("en-US")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .map(normalizeShowcaseToken)
      .filter((token) => token.length >= 3)
      .filter((token) => !/^\d+$/.test(token))
      .filter((token) => !SHOWCASE_IGNORED_TITLE_TOKENS.has(token)),
  )];
}

function getShowcaseMeta(group) {
  const product = group?.representative || group?.product || {};
  return {
    title: String(group?.representativeTitle || product?.title || ""),
    categoryKey: String(group?.representativeCategoryKey || product?.categoryKey || ""),
    popularity: Number(group?.representativePopularity ?? product?.popularity ?? 0),
    createdAt: group?.representativeCreatedAt || product?.createdAt || 0,
    stock: Number(group?.stockTotal ?? product?.stock ?? 0),
  };
}

function showcaseSimilarity(leftTitle, rightTitle) {
  const left = showcaseTitleTokens(leftTitle);
  const right = showcaseTitleTokens(rightTitle);
  if (!left.length || !right.length) return 0;

  const rightSet = new Set(right);
  const shared = left.reduce((sum, token) => sum + Number(rightSet.has(token)), 0);
  const containment = shared / Math.max(Math.min(left.length, right.length), 1);
  const union = new Set([...left, ...right]).size;
  const jaccard = shared / Math.max(union, 1);

  if (left.join(" ") === right.join(" ")) return 1;
  return Math.max(containment, jaccard);
}

function showcaseScore(group) {
  const meta = getShowcaseMeta(group);
  const categoryBonus = SHOWCASE_CATEGORY_BONUS[meta.categoryKey] || 0;
  return (
    categoryBonus +
    Math.log1p(Math.max(meta.popularity, 0)) * 8 +
    Math.log1p(Math.max(meta.stock, 0)) * 3
  );
}

export function selectShowcaseCatalogGroups(groups, limit = 100) {
  const target = Math.max(1, Math.min(Number(limit) || 100, 100));
  const eligible = (Array.isArray(groups) ? groups : [])
    .filter((group) => Boolean(group?.inStock))
    .filter((group) => Boolean(group?.inStockVideo ?? group?.hasVideo))
    .sort((left, right) => {
      const scoreDifference = showcaseScore(right) - showcaseScore(left);
      if (scoreDifference) return scoreDifference;

      const leftMeta = getShowcaseMeta(left);
      const rightMeta = getShowcaseMeta(right);
      const createdDifference = new Date(rightMeta.createdAt || 0).getTime() -
        new Date(leftMeta.createdAt || 0).getTime();
      return createdDifference ||
        String(left?.groupKey || left?.representativeKey || "").localeCompare(
          String(right?.groupKey || right?.representativeKey || ""),
        );
    });

  const selected = [];
  const selectedKeys = new Set();
  const categoryCounts = new Map();
  const categoryCap = Math.max(8, Math.ceil(target / 7));

  function groupKey(group) {
    return String(group?.groupKey || group?._id || group?.representativeKey || "").trim();
  }

  function canAdd(group, enforceCategoryCap, similarityLimit) {
    const key = groupKey(group);
    if (!key || selectedKeys.has(key)) return false;

    const meta = getShowcaseMeta(group);
    if (enforceCategoryCap && meta.categoryKey) {
      if ((categoryCounts.get(meta.categoryKey) || 0) >= categoryCap) return false;
    }

    return !selected.some((chosen) => (
      showcaseSimilarity(meta.title, getShowcaseMeta(chosen).title) >= similarityLimit
    ));
  }

  function addPass(enforceCategoryCap, similarityLimit) {
    for (const group of eligible) {
      if (selected.length >= target) break;
      if (!canAdd(group, enforceCategoryCap, similarityLimit)) continue;

      const meta = getShowcaseMeta(group);
      selected.push(group);
      selectedKeys.add(groupKey(group));
      if (meta.categoryKey) {
        categoryCounts.set(meta.categoryKey, (categoryCounts.get(meta.categoryKey) || 0) + 1);
      }
    }
  }

  // First pass keeps both product-type similarity and category domination low.
  addPass(true, 0.72);
  // If a sparse category mix cannot fill the shelf, keep the same similarity bar
  // but relax only the per-category cap.
  if (selected.length < target) addPass(false, 0.72);
  // Last fill remains conservative: only products that are very close in wording
  // may enter, which is preferable to leaving a 100-card homepage half empty.
  if (selected.length < target) addPass(false, 0.9);

  return selected.slice(0, target);
}

function recommendationTokens(value) {
  return new Set(
    String(value || "")
      .toLocaleLowerCase("en-US")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}

export function rankRelatedCatalogGroups(product, summaries, limit = 8) {
  const currentSupplierId = String(product?.supplierProductId || "").trim();
  const currentGroupKey = getCatalogGroupKey(product);
  const currentTokens = recommendationTokens(product?.title);
  const currentBrand = String(product?.brand || "").trim().toLocaleLowerCase("en-US");
  const currentCategory = String(product?.categoryKey || "").trim();

  return (Array.isArray(summaries) ? summaries : [])
    .filter((summary) => summary?.groupKey && summary.groupKey !== currentGroupKey)
    .map((summary) => {
      const candidate = summary.representative || {};
      const sameSupplier = Boolean(
        currentSupplierId && String(candidate.supplierProductId || "").trim() === currentSupplierId,
      );
      const sameCategory = Boolean(
        currentCategory && String(candidate.categoryKey || "").trim() === currentCategory,
      );
      const candidateBrand = String(candidate.brand || "").trim().toLocaleLowerCase("en-US");
      const candidateTokens = recommendationTokens(candidate.title);
      let sharedTokens = 0;
      for (const token of candidateTokens) {
        if (currentTokens.has(token)) sharedTokens += 1;
      }

      return {
        ...summary,
        recommendationScore:
          (sameSupplier ? 10_000 : 0) +
          (sameCategory ? 1_000 : 0) +
          (currentBrand && candidateBrand === currentBrand ? 100 : 0) +
          sharedTokens * 20 +
          (summary.hasVideo ? 5 : 0) +
          Math.min(Number(candidate.popularity || 0), 100) / 100,
      };
    })
    .filter((summary) => summary.recommendationScore >= 1_000)
    .sort((left, right) =>
      right.recommendationScore - left.recommendationScore ||
      String(left.groupKey).localeCompare(String(right.groupKey)),
    )
    .slice(0, Math.max(Number(limit) || 8, 1));
}
