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

const SHOWCASE_IGNORED_TITLE_TOKENS = new Set([
  "with", "from", "this", "that", "for", "and", "the", "new", "hot", "sale",
  "fashion", "style", "stylish", "casual", "premium", "high", "quality", "latest",
  "portable", "mini", "small", "large", "extra", "plus", "size", "sizes",
  "black", "white", "red", "blue", "green", "pink", "purple", "yellow", "gray",
  "grey", "brown", "beige", "gold", "silver", "women", "womens", "woman",
  "men", "mens", "male", "female", "girl", "girls", "boy", "boys", "adult",
  "piece", "pieces", "pack", "set", "pcs", "pc", "model", "version",
  "2024", "2025", "2026",
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

function showcaseTypeKey(title) {
  const tokens = showcaseTitleTokens(title);
  if (!tokens.length) return "";
  // Product titles often begin with marketing adjectives and end with the real
  // product type. Keeping the last two meaningful words catches separate CJ
  // parents that are effectively the same item (e.g. "... smoothie blender").
  return tokens.slice(-2).join(" ");
}

function compareShowcaseDemand(left, right) {
  const leftMeta = getShowcaseMeta(left);
  const rightMeta = getShowcaseMeta(right);

  return (
    rightMeta.popularity - leftMeta.popularity ||
    rightMeta.stock - leftMeta.stock ||
    new Date(rightMeta.createdAt || 0).getTime() - new Date(leftMeta.createdAt || 0).getTime() ||
    String(left?.groupKey || left?.representativeKey || "").localeCompare(
      String(right?.groupKey || right?.representativeKey || ""),
    )
  );
}

export function selectShowcaseCatalogGroups(groups, limit = 100) {
  const target = Math.max(1, Math.min(Number(limit) || 100, 100));
  const eligible = (Array.isArray(groups) ? groups : [])
    .filter((group) => Boolean(group?.inStock))
    .filter((group) => Boolean(group?.inStockVideo ?? group?.hasVideo))
    .sort(compareShowcaseDemand);

  const selected = [];
  const selectedKeys = new Set();
  const selectedTypeKeys = new Set();
  const categoryCounts = new Map();
  const categoryCap = Math.max(10, Math.ceil(target / 5));

  function groupKey(group) {
    return String(group?.groupKey || group?._id || group?.representativeKey || "").trim();
  }

  function isTooSimilar(group, similarityLimit) {
    const meta = getShowcaseMeta(group);
    const typeKey = showcaseTypeKey(meta.title);

    if (typeKey && selectedTypeKeys.has(typeKey)) return true;

    return selected.some((chosen) => {
      const chosenMeta = getShowcaseMeta(chosen);
      if (meta.categoryKey && chosenMeta.categoryKey && meta.categoryKey !== chosenMeta.categoryKey) {
        return showcaseSimilarity(meta.title, chosenMeta.title) >= 0.82;
      }
      return showcaseSimilarity(meta.title, chosenMeta.title) >= similarityLimit;
    });
  }

  function addPass({ enforceCategoryCap, similarityLimit, enforceTypeKey }) {
    for (const group of eligible) {
      if (selected.length >= target) break;

      const key = groupKey(group);
      if (!key || selectedKeys.has(key)) continue;

      const meta = getShowcaseMeta(group);
      if (
        enforceCategoryCap &&
        meta.categoryKey &&
        (categoryCounts.get(meta.categoryKey) || 0) >= categoryCap
      ) {
        continue;
      }

      const typeKey = showcaseTypeKey(meta.title);
      if (enforceTypeKey && typeKey && selectedTypeKeys.has(typeKey)) continue;
      if (isTooSimilar(group, similarityLimit)) continue;

      selected.push(group);
      selectedKeys.add(key);
      if (typeKey) selectedTypeKeys.add(typeKey);
      if (meta.categoryKey) {
        categoryCounts.set(meta.categoryKey, (categoryCounts.get(meta.categoryKey) || 0) + 1);
      }
    }
  }

  // Start with the strongest CJ demand signals while enforcing hard variety.
  addPass({ enforceCategoryCap: true, similarityLimit: 0.5, enforceTypeKey: true });
  // Relax only the category cap before allowing anything visually repetitive.
  if (selected.length < target) {
    addPass({ enforceCategoryCap: false, similarityLimit: 0.55, enforceTypeKey: true });
  }
  // Final fill keeps duplicate titles blocked but allows a second product type
  // only when the wording is clearly different.
  if (selected.length < target) {
    addPass({ enforceCategoryCap: false, similarityLimit: 0.68, enforceTypeKey: false });
  }

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
