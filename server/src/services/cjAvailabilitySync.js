import { Product } from "../models/Product.js";
import {
  getCjProductDetail,
  getCjProductInventory,
} from "./cjApi.js";
import { buildCjVariantStockMap } from "./cjCatalogSync.js";
import { getCjProductVideoMedia } from "./cjProductVideo.js";
import { buildCjVariantGroupMap } from "./cjVariantGrouping.js";

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_INITIAL_DELAY_MS = 15_000;

let syncRunning = false;

function parseInterval(value, fallback, minimum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum) return fallback;
  return parsed;
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function getMarkupMultiplier() {
  const parsed = Number(process.env.CJ_PRICE_MARKUP || 1.65);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1.65;
}

function getOriginCountryCode() {
  return String(process.env.CJ_FROM_COUNTRY_CODE || "CN").toUpperCase();
}

function getVariantId(variant) {
  return String(variant?.vid || variant?.variantId || "").trim();
}

export function getCjAvailabilityIntervalMs() {
  return parseInterval(
    process.env.CJ_AVAILABILITY_SYNC_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
    15 * 60 * 1000,
  );
}

export function getCjAvailabilityInitialDelayMs() {
  return parseInterval(
    process.env.CJ_AVAILABILITY_SYNC_INITIAL_DELAY_MS,
    DEFAULT_INITIAL_DELAY_MS,
    1_000,
  );
}

export function buildCjAvailabilityChanges(
  storedVariants,
  supplierVariants,
  stockByVariantId,
  markupMultiplier = 1.65,
  videoMedia = { checked: false },
  variantGroupById = new Map(),
) {
  const supplierByVariantId = new Map(
    (Array.isArray(supplierVariants) ? supplierVariants : [])
      .map((variant) => [getVariantId(variant), variant])
      .filter(([variantId]) => variantId),
  );

  return (Array.isArray(storedVariants) ? storedVariants : []).map((product) => {
    const variantId = String(product.supplierVariantId || "").trim();
    const supplierVariant = supplierByVariantId.get(variantId);

    if (!supplierVariant) {
      return {
        productId: product._id,
        stock: 0,
        isActive: false,
        ...(videoMedia.checked
          ? {
            videoUrl: videoMedia.videoUrl,
            videoPosterUrl: videoMedia.videoPosterUrl,
            hasVideo: videoMedia.hasVideo,
          }
          : {}),
        variantGroupKey: variantGroupById.get(variantId) || product.variantGroupKey || "standard-band-1",
      };
    }

    const stock = Math.max(Number(stockByVariantId.get(variantId) || 0), 0);
    const costPrice = roundMoney(supplierVariant.variantSellPrice);

    return {
      productId: product._id,
      stock,
      isActive: stock > 0 && costPrice > 0,
      ...(costPrice > 0
        ? {
          costPrice,
          price: roundMoney(costPrice * markupMultiplier),
        }
        : {}),
      ...(videoMedia.checked
        ? {
          videoUrl: videoMedia.videoUrl,
          videoPosterUrl: videoMedia.videoPosterUrl,
          hasVideo: videoMedia.hasVideo,
        }
        : {}),
      variantGroupKey: variantGroupById.get(variantId) || product.variantGroupKey || "standard-band-1",
    };
  });
}

async function deactivateSupplierProduct(supplierProductId) {
  const result = await Product.updateMany(
    { source: "cj", supplierProductId },
    { $set: { stock: 0, isActive: false } },
  );
  return result.modifiedCount || 0;
}

async function syncSupplierProduct(supplierProductId) {
  const storedVariants = await Product.find({
    source: "cj",
    supplierProductId,
  })
    .select({ _id: 1, supplierVariantId: 1, variantGroupKey: 1 })
    .lean();

  if (storedVariants.length === 0) {
    return { updatedVariants: 0, deactivatedVariants: 0 };
  }

  const detail = await getCjProductDetail(supplierProductId);
  const supplierVariants = Array.isArray(detail?.variants) ? detail.variants : [];

  // A successful CJ response with no variants means the parent product is no
  // longer sellable. Network/API failures throw before this point and never
  // remove products, so a temporary CJ outage cannot empty the storefront.
  if (supplierVariants.length === 0) {
    const deactivatedVariants = await deactivateSupplierProduct(supplierProductId);
    return { updatedVariants: 0, deactivatedVariants };
  }

  const inventory = await getCjProductInventory(supplierProductId);
  const videoMedia = await getCjProductVideoMedia(detail, supplierProductId);
  const storedVariantIds = new Set(
    storedVariants.map((product) => String(product.supplierVariantId || "").trim()),
  );
  const variantGroupById = buildCjVariantGroupMap(
    supplierVariants.filter((variant) => storedVariantIds.has(String(variant?.vid || "").trim())),
  );
  const stockByVariantId = buildCjVariantStockMap(
    inventory,
    getOriginCountryCode(),
  );
  const changes = buildCjAvailabilityChanges(
    storedVariants,
    supplierVariants,
    stockByVariantId,
    getMarkupMultiplier(),
    videoMedia,
    variantGroupById,
  );

  if (changes.length > 0) {
    await Product.bulkWrite(
      changes.map(({ productId, ...fields }) => ({
        updateOne: {
          filter: { _id: productId },
          update: { $set: fields },
        },
      })),
      { ordered: false },
    );
  }

  return {
    updatedVariants: changes.length,
    deactivatedVariants: changes.filter((change) => !change.isActive).length,
  };
}

export async function syncCjAvailability() {
  if (syncRunning) {
    return { skipped: true, reason: "already_running" };
  }

  syncRunning = true;
  try {
    const supplierProductIds = (await Product.distinct("supplierProductId", {
      source: "cj",
      supplierProductId: { $ne: "" },
    }))
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    let checkedProducts = 0;
    let failedProducts = 0;
    let updatedVariants = 0;
    let deactivatedVariants = 0;

    for (const supplierProductId of supplierProductIds) {
      try {
        const result = await syncSupplierProduct(supplierProductId);
        checkedProducts += 1;
        updatedVariants += result.updatedVariants;
        deactivatedVariants += result.deactivatedVariants;
      } catch (error) {
        failedProducts += 1;
        console.warn(
          `CJ availability sync skipped for ${supplierProductId}:`,
          error.message,
        );

        // Authentication, throttling and service failures are global. Stop the
        // run and preserve the remaining cached catalog until CJ is healthy.
        if ([401, 429, 503].includes(Number(error?.statusCode))) break;
      }
    }

    return {
      skipped: false,
      catalogProducts: supplierProductIds.length,
      checkedProducts,
      failedProducts,
      updatedVariants,
      deactivatedVariants,
    };
  } finally {
    syncRunning = false;
  }
}
