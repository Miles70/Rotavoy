import { createHash } from "node:crypto";
import { Product } from "../models/Product.js";
import {
  getCjProductDetail,
  getCjProductInventory,
  getCjVariantStock,
  listCjProducts,
} from "./cjApi.js";
import {
  getRotavoyProductLanguages,
  productTranslationsComplete,
  translateProductBundle,
} from "./productTranslation.js";
import { getCjProductVideoMedia } from "./cjProductVideo.js";
import { buildCjVariantGroupMap } from "./cjVariantGrouping.js";

const LEGACY_DEMO_SOURCE = "amazon-reviews-2023";
const MAX_CJ_PRODUCT_IMAGES = 8;
const MAX_CJ_LIST_PAGE_SIZE = 100;
const MAX_CJ_LIST_PAGE = 1000;
const MAX_CATALOG_TARGET = 5_000;
const MAX_CJ_EXACT_IMPORT_PRODUCTS = 100;

function parsePositiveInt(value, fallback, max = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function isTrue(value) {
  return String(value || "false").toLowerCase() === "true";
}

function getMarkupMultiplier() {
  const parsed = Number(process.env.CJ_PRICE_MARKUP || 1.65);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1.65;
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function getLegacyCatalogCleanupFilter() {
  return { source: LEGACY_DEMO_SOURCE };
}

function cleanText(value, maxLength = 300) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeCategory(categoryName = "") {
  const value = String(categoryName).toLowerCase();
  if (/phone|computer|electronic|camera|audio|headphone|charger|smart/.test(value)) return "electronics";
  if (/clothing|apparel|shoe|bag|jewelry|watch|fashion/.test(value)) return "fashion";
  if (/beauty|makeup|skin|hair|personal care|cosmetic/.test(value)) return "beauty";
  if (/sport|outdoor|camp|fitness|cycling|travel/.test(value)) return "sports";
  if (/baby|kid|toy|child/.test(value)) return "baby";
  if (/pet|dog|cat|animal/.test(value)) return "pets";
  if (/automotive|car|motorcycle|vehicle/.test(value)) return "automotive";
  if (/tool|hardware|garden/.test(value)) return "tools";
  if (/game|gaming/.test(value)) return "gaming";
  if (/office|stationery/.test(value)) return "office";
  if (/appliance/.test(value)) return "appliances";
  return "home";
}

function flattenListV2(data) {
  const content = Array.isArray(data?.content) ? data.content : [];
  return content.flatMap((entry) => Array.isArray(entry?.productList) ? entry.productList : []);
}

function getCjProductId(product) {
  return String(product?.id || product?.pid || "").trim();
}

function getCjDemandScore(product) {
  return Math.max(0, ...[
    product?.listedNum,
    product?.listNum,
    product?.sellCount,
    product?.saleCount,
  ].map((value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }));
}

export function rankCjProductsByDemand(products) {
  return [...(Array.isArray(products) ? products : [])]
    .map((product, index) => ({ product, index }))
    .sort((left, right) => (
      getCjDemandScore(right.product) - getCjDemandScore(left.product) ||
      left.index - right.index
    ))
    .map(({ product }) => product);
}

function sumOriginStock(rows, originCountryCode) {
  const origin = String(originCountryCode || "CN").toUpperCase();
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    if (String(row?.countryCode || "").toUpperCase() !== origin) return sum;
    const quantity = row?.totalInventoryNum ?? row?.totalInventory ?? 0;
    return sum + Math.max(Number(quantity || 0), 0);
  }, 0);
}

export function buildCjVariantStockMap(productInventory, originCountryCode = "CN") {
  const rows = Array.isArray(productInventory?.variantInventories)
    ? productInventory.variantInventories
    : Array.isArray(productInventory?.variantInventory)
      ? productInventory.variantInventory
      : [];
  const stockByVariantId = new Map();

  for (const row of rows) {
    const vid = String(row?.vid || row?.variantId || "").trim();
    if (!vid) continue;
    stockByVariantId.set(vid, sumOriginStock(row?.inventory, originCountryCode));
  }

  return stockByVariantId;
}

function getVariantLabel(variant) {
  return cleanText(
    variant?.variantKey || variant?.variantNameEn || variant?.variantSku || "Default",
    160,
  );
}

function appendVariantToTitle(title, variantLabel) {
  const cleanTitle = cleanText(title, 260);
  const cleanVariant = cleanText(variantLabel, 160);
  if (!cleanVariant || cleanVariant.toLowerCase() === "default") return cleanTitle;
  if (cleanTitle.toLowerCase().includes(cleanVariant.toLowerCase())) return cleanTitle;
  return `${cleanTitle} - ${cleanVariant}`.slice(0, 300);
}

function buildVariantTitle(productTitle, variant) {
  return appendVariantToTitle(productTitle, getVariantLabel(variant));
}

function compactSupplierFacts(detail, variant, originCountryCode) {
  const facts = {
    brand: cleanText(detail?.supplierName || detail?.brandName, 160),
    productSku: cleanText(detail?.productSku, 120),
    productType: cleanText(detail?.productType, 160),
    productUnit: cleanText(detail?.productUnit, 80),
    material: cleanText(detail?.material || detail?.productMaterial, 300),
    productWeightGrams: Number(detail?.productWeight || 0) || undefined,
    packingWeightGrams: Number(detail?.packingWeight || 0) || undefined,
    packingLength: Number(detail?.packingLength || 0) || undefined,
    packingWidth: Number(detail?.packingWidth || 0) || undefined,
    packingHeight: Number(detail?.packingHeight || 0) || undefined,
    packingList: cleanText(detail?.packingList, 1_000),
    property: cleanText(detail?.propertyKey || detail?.productProperty, 1_000),
    variant: getVariantLabel(variant),
    variantSku: cleanText(variant?.variantSku, 120),
    variantUnit: cleanText(variant?.variantUnit, 80),
    variantProperty: cleanText(variant?.variantProperty || variant?.variantNameEn, 1_000),
    variantWeightGrams: Number(variant?.variantWeight || 0) || undefined,
    variantLength: Number(variant?.variantLength || 0) || undefined,
    variantWidth: Number(variant?.variantWidth || 0) || undefined,
    variantHeight: Number(variant?.variantHeight || 0) || undefined,
    originCountry: String(originCountryCode || "CN").toUpperCase(),
  };

  return Object.fromEntries(
    Object.entries(facts).filter(([, value]) => (
      value !== undefined && value !== null && value !== ""
    )),
  );
}

function normalizeImageUrl(value) {
  const url = String(value || "")
    .trim()
    .replace(/&amp;/gi, "&");
  return /^https?:\/\//i.test(url) ? url : "";
}

function uniqueUrls(values, limit = MAX_CJ_PRODUCT_IMAGES) {
  const unique = [];
  const seen = new Set();

  for (const value of values) {
    const url = normalizeImageUrl(value);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
    if (unique.length >= limit) break;
  }

  return unique;
}

export function extractCjDescriptionImageUrls(html) {
  const source = String(html || "");
  const urls = [];
  const imageTags = source.match(/<img\b[^>]*>/gi) || [];
  const imageAttributePattern = /\s(?:src|data-src|data-original|data-lazy-src)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i;

  for (const imageTag of imageTags) {
    const match = imageTag.match(imageAttributePattern);
    const url = match?.[1] || match?.[2] || match?.[3] || "";
    if (url) urls.push(url);
  }

  return uniqueUrls(urls);
}

function createTranslationSourceHash({ title, description, categoryLabel, variants, structuredFacts }) {
  return createHash("sha256")
    .update(JSON.stringify({ title, description, categoryLabel, variants, structuredFacts }))
    .digest("hex");
}

function buildVariantTranslations(bundle, variantIndex, fallback) {
  const translations = {};

  for (const [language, localized] of Object.entries(bundle || {})) {
    const localizedVariant = String(localized?.variants?.[variantIndex] || fallback.variant).trim();
    const localizedBaseTitle = String(localized?.title || fallback.title).trim();

    translations[language] = {
      title: appendVariantToTitle(localizedBaseTitle, localizedVariant),
      description: String(localized?.description ?? fallback.description).trim(),
      categoryLabel: String(localized?.categoryLabel || fallback.categoryLabel).trim(),
      variant: localizedVariant,
    };
  }

  return translations;
}

export function hasFreshProfessionalContent(existing, sourceHash) {
  return Boolean(
    existing &&
    existing.contentMeta?.status === "ready" &&
    existing.contentMeta?.sourceHash === sourceHash &&
    productTranslationsComplete(existing.translations),
  );
}

export function shouldPreserveExistingTranslations(existing, translationBundle) {
  const bundleComplete = getRotavoyProductLanguages().every((language) => translationBundle?.[language]);
  return Boolean(
    !bundleComplete &&
    existing &&
    productTranslationsComplete(existing.translations),
  );
}

async function discoverCjProducts({
  keywords,
  targetCount,
  pageSize,
  maxPagesPerKeyword,
  maxProductsPerKeyword,
  excludedProductIds,
}) {
  if (targetCount < 1) {
    return {
      products: [],
      pagesFetched: 0,
      duplicateProductsSkipped: 0,
      existingProductsSkipped: 0,
    };
  }

  const products = [];
  const seenProductIds = new Set();
  const exhaustedKeywords = new Set();
  const selectedByKeyword = new Map(keywords.map((keyword) => [keyword, 0]));
  let pagesFetched = 0;
  let duplicateProductsSkipped = 0;
  let existingProductsSkipped = 0;

  for (let page = 1; page <= maxPagesPerKeyword && products.length < targetCount; page += 1) {
    for (const keyword of keywords) {
      if (products.length >= targetCount) break;
      if (exhaustedKeywords.has(keyword)) continue;

      const data = await listCjProducts({ page, size: pageSize, keyWord: keyword });
      pagesFetched += 1;
      const pageProducts = rankCjProductsByDemand(flattenListV2(data));

      if (pageProducts.length === 0) {
        exhaustedKeywords.add(keyword);
        continue;
      }

      let selectedForKeyword = selectedByKeyword.get(keyword) || 0;
      for (const product of pageProducts) {
        if (selectedForKeyword >= maxProductsPerKeyword) {
          exhaustedKeywords.add(keyword);
          break;
        }

        const pid = getCjProductId(product);
        if (!pid) continue;

        if (excludedProductIds.has(pid)) {
          existingProductsSkipped += 1;
          continue;
        }

        if (seenProductIds.has(pid)) {
          duplicateProductsSkipped += 1;
          continue;
        }

        seenProductIds.add(pid);
        products.push(product);
        selectedForKeyword += 1;
        if (products.length >= targetCount) break;
      }
      selectedByKeyword.set(keyword, selectedForKeyword);

      if (pageProducts.length < pageSize) {
        exhaustedKeywords.add(keyword);
      }
    }
  }

  return {
    products,
    pagesFetched,
    duplicateProductsSkipped,
    existingProductsSkipped,
  };
}

async function syncOneProduct(listProduct, options) {
  const pid = getCjProductId(listProduct);
  if (!pid) return { upserted: 0, activeVariants: 0, skipped: 1 };

  const detail = await getCjProductDetail(pid);
  const variants = Array.isArray(detail?.variants) ? detail.variants : [];
  const selectedVariants = variants;
  const productTitle = cleanText(detail?.productNameEn || detail?.nameEn || listProduct?.nameEn, 260);
  const variantGroupById = buildCjVariantGroupMap(selectedVariants, {
    productTitle,
  });
  if (!productTitle || selectedVariants.length === 0) {
    return { upserted: 0, activeVariants: 0, skipped: 1 };
  }

  const categoryLabel = cleanText(
    detail?.categoryName || listProduct?.threeCategoryName || listProduct?.twoCategoryName || listProduct?.oneCategoryName || "General",
    160,
  );
  const categoryKey = normalizeCategory(categoryLabel);
  const rawDescription = String(detail?.description || listProduct?.description || "");
  const description = cleanText(rawDescription, 6000);
  const baseImage = detail?.productImage || detail?.bigImage || detail?.productImageSet?.[0] || listProduct?.bigImage || "";
  const descriptionImages = extractCjDescriptionImageUrls(rawDescription);
  const variantLabels = selectedVariants.map(getVariantLabel);
  const structuredFacts = selectedVariants.map((variant) => (
    compactSupplierFacts(detail, variant, options.originCountryCode)
  ));
  const sourceHash = createTranslationSourceHash({
    title: productTitle,
    description,
    categoryLabel,
    variants: variantLabels,
    structuredFacts,
  });
  const videoMedia = await getCjProductVideoMedia(detail, pid);

  const selectedVariantIds = selectedVariants
    .map((variant) => String(variant?.vid || "").trim())
    .filter(Boolean);

  const existingProducts = selectedVariantIds.length
    ? await Product.find({
      source: "cj",
      supplierProductId: pid,
      supplierVariantId: { $in: selectedVariantIds },
    })
      .select({
        supplierVariantId: 1,
        title: 1,
        description: 1,
        features: 1,
        categoryLabel: 1,
        supplierContent: 1,
        contentMeta: 1,
        translations: 1,
        translationMeta: 1,
      })
      .lean()
    : [];

  const existingByVariantId = new Map(
    existingProducts.map((product) => [String(product.supplierVariantId || ""), product]),
  );

  const canReuseTranslations = selectedVariantIds.length > 0 && selectedVariantIds.every((vid) => {
    const existing = existingByVariantId.get(vid);
    return Boolean(
      existing &&
      existing.translationMeta?.sourceHash === sourceHash &&
      productTranslationsComplete(existing.translations),
    );
  });

  const translationBundle = canReuseTranslations
    ? null
    : await translateProductBundle({
      title: productTitle,
      description,
      categoryLabel,
      variants: variantLabels,
    });

  let productStockByVariantId = new Map();
  try {
    const productInventory = await getCjProductInventory(pid);
    productStockByVariantId = buildCjVariantStockMap(productInventory, options.originCountryCode);
  } catch (error) {
    console.warn(`CJ product inventory fallback for ${pid}:`, error.message);
  }

  let upserted = 0;
  let activeVariants = 0;

  for (let variantIndex = 0; variantIndex < selectedVariants.length; variantIndex += 1) {
    const variant = selectedVariants[variantIndex];
    const vid = String(variant?.vid || "").trim();
    if (!vid) continue;

    const costPrice = roundMoney(variant?.variantSellPrice);
    if (!(costPrice > 0)) continue;

    let stock = productStockByVariantId.get(vid);
    if (stock === undefined) {
      const stockRows = await getCjVariantStock(vid);
      stock = sumOriginStock(stockRows, options.originCountryCode);
    }

    const images = uniqueUrls([
      variant?.variantImage || "",
      baseImage,
      ...descriptionImages,
    ]);
    if (!images.length) continue;
    const title = buildVariantTitle(productTitle, variant);
    const variantLabel = variantLabels[variantIndex] || "Default";
    const price = roundMoney(costPrice * options.markupMultiplier);
    const key = `cj-${vid}`;
    const existing = existingByVariantId.get(vid);
    const preserveProfessional = hasFreshProfessionalContent(existing, sourceHash);
    const preserveExistingTranslations = !canReuseTranslations && shouldPreserveExistingTranslations(
      existing,
      translationBundle,
    );
    const translations = preserveProfessional || canReuseTranslations || preserveExistingTranslations
      ? existing.translations
      : buildVariantTranslations(translationBundle, variantIndex, {
        title,
        description,
        categoryLabel,
        variant: variantLabel,
      });
    const translationMeta = preserveProfessional ||
      (canReuseTranslations && existing?.translationMeta) ||
      (preserveExistingTranslations && existing?.translationMeta)
      ? existing.translationMeta
      : {
        provider: "source",
        sourceHash,
        sourceLanguage: "en",
        languages: Object.keys(translations || {}),
        updatedAt: new Date(),
      };
    const contentMeta = preserveProfessional
      ? existing.contentMeta
      : {
        status: "pending",
        provider: "",
        model: "",
        version: "",
        sourceHash,
        updatedAt: new Date(),
        error: "",
      };

    await Product.findOneAndUpdate(
      { key },
      {
        $set: {
          title: preserveProfessional ? (existing.title || title) : title,
          description: preserveProfessional ? (existing.description ?? description) : description,
          features: preserveProfessional && Array.isArray(existing.features) ? existing.features : [],
          details: {
            supplier: "CJdropshipping",
            variant: variantLabel,
            sku: cleanText(variant?.variantSku, 100),
            originCountry: options.originCountryCode,
            weightGrams: Number(variant?.variantWeight || 0),
          },
          supplierContent: {
            title: productTitle,
            description,
            categoryLabel,
            variant: variantLabel,
            brand: cleanText(detail?.supplierName || detail?.brandName, 160),
            facts: structuredFacts[variantIndex],
          },
          contentMeta,
          translations,
          translationMeta,
          sourceLanguage: "en",
          sourceHash,
          brand: cleanText(detail?.supplierName, 120),
          quantity: "",
          categoryKey,
          categoryLabel: preserveProfessional ? (existing.categoryLabel || categoryLabel) : categoryLabel,
          price,
          oldPrice: null,
          currency: "USD",
          costPrice,
          badge: "stock",
          image: "🛍️",
          imageUrl: images[0] || "",
          images,
          ...(videoMedia.checked
            ? {
              videoUrl: videoMedia.videoUrl,
              videoPosterUrl: videoMedia.videoPosterUrl,
              hasVideo: videoMedia.hasVideo,
            }
            : {}),
          stock,
          rating: 0,
          reviewCount: 0,
          popularity: Math.max(Number(listProduct?.listedNum || detail?.listedNum || 0), 0),
          source: "cj",
          sourceType: "dropshipping",
          sourceCode: vid,
          sourceUrl: "",
          supplier: "cj",
          supplierProductId: pid,
          supplierVariantId: vid,
          variantGroupKey: variantGroupById.get(vid) || "product",
          supplierSku: cleanText(variant?.variantSku, 100),
          isActive: stock > 0,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    );

    upserted += 1;
    if (stock > 0) activeVariants += 1;
  }

  if (selectedVariantIds.length > 0) {
    await Product.updateMany(
      {
        source: "cj",
        supplierProductId: pid,
        supplierVariantId: { $nin: selectedVariantIds },
      },
      { $set: { isActive: false, stock: 0 } },
    );
  }

  return {
    upserted,
    activeVariants,
    skipped: upserted > 0 ? 0 : 1,
  };
}

export async function syncCjProductsByIds(productIds = []) {
  const normalizedIds = [...new Set(
    (Array.isArray(productIds) ? productIds : [productIds])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  )];

  if (normalizedIds.length > MAX_CJ_EXACT_IMPORT_PRODUCTS) {
    throw new Error(
      `Exact CJ import is limited to ${MAX_CJ_EXACT_IMPORT_PRODUCTS} products per run.`,
    );
  }

  const options = {
    markupMultiplier: getMarkupMultiplier(),
    originCountryCode: String(process.env.CJ_FROM_COUNTRY_CODE || "CN").toUpperCase(),
  };
  const results = [];
  let importedProducts = 0;
  let failedProducts = 0;
  let skippedProducts = 0;
  let upsertedVariants = 0;
  let activeVariants = 0;

  for (const pid of normalizedIds) {
    try {
      const result = await syncOneProduct({ id: pid, pid }, options);
      importedProducts += result.skipped ? 0 : 1;
      skippedProducts += result.skipped;
      upsertedVariants += result.upserted;
      activeVariants += result.activeVariants;
      results.push({
        pid,
        status: result.skipped ? "skipped" : "imported",
        upsertedVariants: result.upserted,
        activeVariants: result.activeVariants,
      });
    } catch (error) {
      failedProducts += 1;
      results.push({
        pid,
        status: "failed",
        error: String(error?.message || error),
      });
    }
  }

  return {
    requestedProducts: normalizedIds.length,
    importedProducts,
    failedProducts,
    skippedProducts,
    upsertedVariants,
    activeVariants,
    markupMultiplier: options.markupMultiplier,
    originCountryCode: options.originCountryCode,
    results,
  };
}

export async function syncCjCatalog() {
  const keywords = String(process.env.CJ_SYNC_KEYWORDS || "travel,electronics,home,beauty,sports")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const maxProductsPerKeyword = parsePositiveInt(process.env.CJ_SYNC_PRODUCTS_PER_KEYWORD, 6, MAX_CJ_LIST_PAGE_SIZE);
  const requestedTarget = parsePositiveInt(process.env.CJ_SYNC_TARGET_PRODUCTS, 0, MAX_CATALOG_TARGET);
  const targetProducts = requestedTarget || Math.min(keywords.length * maxProductsPerKeyword, MAX_CATALOG_TARGET);
  const pageSize = parsePositiveInt(
    process.env.CJ_SYNC_PAGE_SIZE,
    requestedTarget ? MAX_CJ_LIST_PAGE_SIZE : maxProductsPerKeyword,
    MAX_CJ_LIST_PAGE_SIZE,
  );
  const maxPagesPerKeyword = parsePositiveInt(
    process.env.CJ_SYNC_MAX_PAGES_PER_KEYWORD,
    requestedTarget ? 20 : 1,
    MAX_CJ_LIST_PAGE,
  );
  const batchSize = parsePositiveInt(process.env.CJ_SYNC_BATCH_SIZE, 100, 500);

  const onlyNew = isTrue(process.env.CJ_SYNC_ONLY_NEW);
  // Localization is owned exclusively by the Luna content pipeline.
  // CJ sync keeps only the untouched English source as a pending fallback.
  const autoTranslation = false;
  const options = {

    markupMultiplier: getMarkupMultiplier(),
    originCountryCode: String(process.env.CJ_FROM_COUNTRY_CODE || "CN").toUpperCase(),
  };

  const existingProductIds = onlyNew
    ? new Set((await Product.distinct("supplierProductId", {
      source: "cj",
      supplierProductId: { $ne: "" },
    })).map((value) => String(value || "").trim()).filter(Boolean))
    : new Set();
  const existingActiveProductIds = onlyNew
    ? new Set((await Product.distinct("supplierProductId", {
      source: "cj",
      supplierProductId: { $ne: "" },
      isActive: true,
      stock: { $gt: 0 },
    })).map((value) => String(value || "").trim()).filter(Boolean))
    : new Set();

  const activeProductsNeeded = onlyNew
    ? Math.max(targetProducts - existingActiveProductIds.size, 0)
    : targetProducts;
  const discoveryBuffer = onlyNew && activeProductsNeeded > 0
    ? Math.max(100, Math.ceil(activeProductsNeeded * 0.35))
    : 0;
  const discoveryTarget = Math.min(
    activeProductsNeeded + discoveryBuffer,
    MAX_CATALOG_TARGET + Math.max(100, Math.ceil(MAX_CATALOG_TARGET * 0.35)),
  );

  const discovery = await discoverCjProducts({
    keywords,
    targetCount: discoveryTarget,
    pageSize,
    maxPagesPerKeyword,
    maxProductsPerKeyword,
    excludedProductIds: existingProductIds,
  });

  let importedProducts = 0;
  let activeImportedProducts = 0;
  let upsertedVariants = 0;
  let activeVariants = 0;
  let skippedProducts = 0;
  let failedProducts = 0;

  for (let offset = 0; offset < discovery.products.length; offset += batchSize) {
    if (onlyNew && activeImportedProducts >= activeProductsNeeded) break;

    const batch = discovery.products.slice(offset, offset + batchSize);
    for (const product of batch) {
      if (onlyNew && activeImportedProducts >= activeProductsNeeded) break;

      try {
        const result = await syncOneProduct(product, options);
        importedProducts += 1;
        upsertedVariants += result.upserted;
        activeVariants += result.activeVariants;
        skippedProducts += result.skipped;
        if (result.activeVariants > 0) activeImportedProducts += 1;
      } catch (error) {
        failedProducts += 1;
        console.warn(`CJ product sync skipped for ${getCjProductId(product) || "unknown"}:`, error.message);
        if ([401, 429, 503].includes(Number(error?.statusCode))) throw error;
      }
    }

    console.log(
      `CJ catalog batch complete: ${Math.min(offset + batch.length, discovery.products.length)}/${discovery.products.length} candidates, ${activeImportedProducts} active new products.`,
    );
  }

  let deletedLegacyCount = 0;
  if (upsertedVariants > 0 && String(process.env.CJ_REPLACE_LEGACY_CATALOG || "true").toLowerCase() !== "false") {
    // Admin-created products also use source="manual". Never include that source
    // here: a catalog sync must not be able to erase genuine manual inventory.
    const cleanup = await Product.deleteMany(getLegacyCatalogCleanupFilter());
    deletedLegacyCount = cleanup.deletedCount || 0;
  }

  const activeCatalogProducts = onlyNew
    ? existingActiveProductIds.size + activeImportedProducts
    : null;

  return {
    keywords,
    catalogTarget: targetProducts,
    activeCatalogProducts,
    targetReached: onlyNew ? activeCatalogProducts >= targetProducts : null,
    existingProducts: onlyNew ? existingProductIds.size : null,
    existingActiveProducts: onlyNew ? existingActiveProductIds.size : null,
    discoveredCandidates: discovery.products.length,
    pagesFetched: discovery.pagesFetched,
    duplicateProductsSkipped: discovery.duplicateProductsSkipped,
    existingProductsSkipped: discovery.existingProductsSkipped,
    importedProducts,
    activeImportedProducts,
    failedProducts,
    upsertedVariants,
    activeVariants,
    skippedProducts,
    deletedLegacyCount,
    batchSize,
    pageSize,
    maxPagesPerKeyword,
    markupMultiplier: options.markupMultiplier,
    originCountryCode: options.originCountryCode,
    productLanguages: getRotavoyProductLanguages(),
    autoTranslation,
    onlyNew,
  };
}
