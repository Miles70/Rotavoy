import { Product } from "../models/Product.js";
import {
  getRotavoyProductLanguages,
  productTranslationsComplete,
  translateProductBundle,
} from "./productTranslation.js";

const DEFAULT_LIMIT = 20;

function parseLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, 500);
}

function cleanText(value, maxLength = 300) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function appendVariant(title, variant) {
  const cleanTitle = cleanText(title, 260);
  const cleanVariant = cleanText(variant, 160);
  if (!cleanVariant || cleanVariant.toLowerCase() === "default") return cleanTitle;
  if (cleanTitle.toLowerCase().includes(cleanVariant.toLowerCase())) return cleanTitle;
  return `${cleanTitle} - ${cleanVariant}`.slice(0, 300);
}

export function translationBundleComplete(bundle) {
  return getRotavoyProductLanguages().every((language) => {
    const entry = bundle?.[language];
    return Boolean(
      entry &&
      cleanText(entry.title) &&
      Object.prototype.hasOwnProperty.call(entry, "description") &&
      cleanText(entry.categoryLabel) &&
      Array.isArray(entry.variants),
    );
  });
}

export function isTranslationRateLimitError(error) {
  return Number(error?.statusCode) === 429;
}

function buildVariantTranslations(bundle, variantIndex, fallbackVariant) {
  return Object.fromEntries(
    Object.entries(bundle).map(([language, entry]) => {
      const variant = cleanText(entry.variants?.[variantIndex] || fallbackVariant) || "Default";
      return [language, {
        title: appendVariant(entry.title, variant),
        description: String(entry.description || "").trim(),
        categoryLabel: cleanText(entry.categoryLabel, 220),
        variant,
        ...(Array.isArray(entry.features) ? { features: entry.features } : {}),
      }];
    }),
  );
}

async function findPendingSupplierProductIds(limit) {
  const rows = await Product.aggregate([
    {
      $match: {
        source: "cj",
        supplierProductId: { $type: "string", $ne: "" },
        $or: getRotavoyProductLanguages().map((language) => ({
          [`translations.${language}.title`]: { $exists: false },
        })),
      },
    },
    { $group: { _id: "$supplierProductId" } },
    { $sort: { _id: 1 } },
    { $limit: limit },
  ]).allowDiskUse(true);
  return rows.map((row) => String(row._id || "").trim()).filter(Boolean);
}

async function backfillSupplierProduct(supplierProductId) {
  const products = await Product.find({ source: "cj", supplierProductId })
    .sort({ supplierVariantId: 1, key: 1 })
    .lean();
  if (!products.length) return { status: "skipped", supplierProductId };
  if (products.every((product) => productTranslationsComplete(product.translations))) {
    return { status: "skipped", supplierProductId };
  }

  const first = products[0];
  const supplierContent = first.supplierContent || {};
  const variants = products.map((product) => cleanText(
    product.supplierContent?.variant || product.details?.variant || product.supplierSku || "Default",
    160,
  ));
  const source = {
    title: cleanText(supplierContent.title || first.title, 260),
    description: cleanText(supplierContent.description || first.description, 1800),
    categoryLabel: cleanText(supplierContent.categoryLabel || first.categoryLabel || "General", 220),
    variants,
  };
  const bundle = await translateProductBundle(source);
  if (!translationBundleComplete(bundle)) {
    throw new Error("Translation provider returned an incomplete language bundle.");
  }

  const now = new Date();
  const operations = products.map((product, index) => ({
    updateOne: {
      filter: { _id: product._id, sourceHash: product.sourceHash },
      update: {
        $set: {
          translations: buildVariantTranslations(bundle, index, variants[index]),
          translationMeta: {
            provider: "google-translate",
            sourceHash: product.sourceHash,
            sourceLanguage: "en",
            languages: getRotavoyProductLanguages(),
            updatedAt: now,
          },
        },
      },
    },
  }));
  const result = await Product.bulkWrite(operations, { ordered: false });
  if (Number(result.matchedCount || 0) !== products.length) {
    throw new Error("Supplier data changed during translation; retry this product.");
  }
  return { status: "translated", supplierProductId, variants: products.length };
}

export async function backfillMissingProductTranslations({ limit } = {}) {
  const safeLimit = parseLimit(limit ?? process.env.PRODUCT_TRANSLATION_BACKFILL_LIMIT);
  const supplierProductIds = await findPendingSupplierProductIds(safeLimit);
  const results = [];
  let rateLimited = false;

  for (const supplierProductId of supplierProductIds) {
    try {
      results.push(await backfillSupplierProduct(supplierProductId));
    } catch (error) {
      results.push({
        status: "failed",
        supplierProductId,
        error: cleanText(error?.message || "Translation failed.", 500),
      });
      if (isTranslationRateLimitError(error)) {
        rateLimited = true;
        break;
      }
    }
  }

  return {
    requested: supplierProductIds.length,
    translated: results.filter((result) => result.status === "translated").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    rateLimited,
    stoppedEarly: results.length < supplierProductIds.length,
    results,
  };
}
