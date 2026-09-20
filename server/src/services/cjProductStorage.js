function uniqueStrings(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [values])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  )];
}

export function compactVariantTranslations(translations) {
  if (!translations || typeof translations !== "object") return {};

  return Object.fromEntries(
    Object.entries(translations).map(([language, entry]) => {
      const value = entry && typeof entry === "object" ? entry : {};
      return [language, {
        title: String(value.title || "").trim(),
        description: "",
        categoryLabel: String(value.categoryLabel || "").trim(),
        variant: String(value.variant || "").trim(),
      }];
    }),
  );
}

export function compactVariantSupplierContent(supplierContent) {
  const source = supplierContent && typeof supplierContent === "object"
    ? supplierContent
    : {};

  return {
    variant: String(source.variant || "").trim(),
    ...(source.facts && typeof source.facts === "object" ? { facts: Object.fromEntries(Object.entries(source.facts).filter(([key]) => key === "originCountry" || key.startsWith("variant"))) } : {}),
  };
}

function mergeTranslationEntry(sharedEntry, variantEntry) {
  const shared = sharedEntry && typeof sharedEntry === "object" ? sharedEntry : {};
  const variant = variantEntry && typeof variantEntry === "object" ? variantEntry : {};
  const merged = { ...shared, ...variant };

  if (!String(variant.description || "").trim() && String(shared.description || "").trim()) {
    merged.description = shared.description;
  }
  if ((!Array.isArray(variant.features) || variant.features.length === 0) && Array.isArray(shared.features)) {
    merged.features = shared.features;
  }

  return merged;
}

export function mergeSharedProductContent(product, sharedProduct) {
  if (!product || typeof product !== "object") return product;
  if (!sharedProduct || typeof sharedProduct !== "object") return product;

  const productTranslations = product.translations && typeof product.translations === "object"
    ? product.translations
    : {};
  const sharedTranslations = sharedProduct.translations && typeof sharedProduct.translations === "object"
    ? sharedProduct.translations
    : {};
  const languages = new Set([
    ...Object.keys(sharedTranslations),
    ...Object.keys(productTranslations),
  ]);
  const translations = Object.fromEntries(
    [...languages].map((language) => [
      language,
      mergeTranslationEntry(sharedTranslations[language], productTranslations[language]),
    ]),
  );

  const productImages = Array.isArray(product.images) ? product.images : [];
  const sharedImages = Array.isArray(sharedProduct.images) ? sharedProduct.images : [];
  const images = uniqueStrings([
    product.imageUrl,
    ...productImages,
    sharedProduct.imageUrl,
    ...sharedImages,
  ]);

  return {
    ...product,
    description: String(product.description || "").trim()
      ? product.description
      : sharedProduct.description || "",
    features: Array.isArray(product.features) && product.features.length
      ? product.features
      : Array.isArray(sharedProduct.features) ? sharedProduct.features : [],
    images,
    videoUrl: product.videoUrl || sharedProduct.videoUrl || "",
    videoPosterUrl: product.videoPosterUrl || sharedProduct.videoPosterUrl || "",
    hasVideo: Boolean(product.hasVideo || sharedProduct.hasVideo),
    translations,
  };
}

export function chooseSharedContentOwner(products) {
  const rows = Array.isArray(products) ? products.filter(Boolean) : [];
  if (!rows.length) return null;

  const existing = rows.find((product) => product.sharedContentOwner);
  if (existing) return existing;

  const score = (product) => {
    const translations = product?.translations && typeof product.translations === "object"
      ? Object.values(product.translations)
      : [];
    const translatedDescriptions = translations.filter((entry) =>
      String(entry?.description || "").trim(),
    ).length;

    return (
      Number(product?.contentMeta?.status === "ready") * 1_000_000 +
      translatedDescriptions * 10_000 +
      Math.min(String(product?.description || "").length, 6_000) * 10 +
      Number(product?.isActive) * 100 +
      Math.min(Array.isArray(product?.images) ? product.images.length : 0, 20)
    );
  };

  return [...rows].sort((left, right) => (
    score(right) - score(left) ||
    String(left?.supplierVariantId || left?.key || "").localeCompare(
      String(right?.supplierVariantId || right?.key || ""),
    )
  ))[0];
}
