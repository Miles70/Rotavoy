import { Router } from "express";
import { Product } from "../models/Product.js";
import { isCjConfigured } from "../services/cjApi.js";
import {
  buildCatalogSearchConditions,
  buildCatalogSearchExclusions,
} from "../services/catalogSearch.js";
import {
  buildGroupedStorefrontProduct,
  buildCatalogGroupSummaries,
  getAllLocalizedSearchFields,
  normalizeStorefrontLanguage,
  STOREFRONT_PRIVATE_FIELDS,
  trimStorefrontTranslations,
} from "../services/storefrontProduct.js";

export const productListRouter = Router();

const LEGACY_SOURCES = ["amazon-reviews-2023", "manual"];
const CATEGORY_GROUPS = {
  electronics: ["electronics", "mobile"],
  fashion: ["fashion"],
  homeLivingOffice: ["home", "office", "appliances"],
  autoGardenTools: ["automotive", "tools"],
  motherBabyToys: ["baby", "toys"],
  sportsOutdoor: ["sports"],
  beautyCare: ["beauty"],
  supermarketPets: ["pets"],
  booksMusicFilmHobby: ["gaming"],
};

const FEATURED_CATEGORY_PREVIEW_LIMIT = 3;
const FEATURED_CATEGORY_CANDIDATE_LIMIT = 8;
const FEATURED_CATEGORY_CACHE_TTL_MS = 2 * 60 * 1000;
const featuredCategoryCache = new Map();

function hasProductImage(product) {
  return Boolean(
    String(product?.imageUrl || "").trim() ||
    (Array.isArray(product?.images) && product.images.some((image) => String(image || "").trim())),
  );
}

function getCachedFeaturedCategories(cacheKey) {
  const cached = featuredCategoryCache.get(cacheKey);
  if (!cached || cached.expiresAt <= Date.now()) {
    featuredCategoryCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function cacheFeaturedCategories(cacheKey, value) {
  featuredCategoryCache.set(cacheKey, {
    expiresAt: Date.now() + FEATURED_CATEGORY_CACHE_TTL_MS,
    value,
  });
}

async function getGroupedCjCatalog({ filter, sortMode, requestedPage, limit, language }) {
  // Pull only lightweight fields, then group and sort parent products in Node.
  // Sorting complete product documents in Mongo can exceed Atlas' 32 MB
  // in-memory limit because every variant contains large translation bundles.
  const rows = await Product.find(filter)
    .select("_id key supplierProductId variantGroupKey price popularity createdAt stock hasVideo")
    .lean();
  const summaries = buildCatalogGroupSummaries(rows, sortMode);
  const total = summaries.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const skip = (page - 1) * limit;
  const pageSummaries = summaries.slice(skip, skip + limit);
  const representativeIds = pageSummaries.map((summary) => summary.representative._id);
  const representativeProducts = await Product.find({ _id: { $in: representativeIds } })
    .select(STOREFRONT_PRIVATE_FIELDS)
    .lean();
  const productsById = new Map(
    representativeProducts.map((product) => [String(product._id), product]),
  );
  const groups = pageSummaries
    .map((summary) => ({
      product: productsById.get(String(summary.representative._id)),
      variantCount: summary.variantCount,
      priceMin: summary.priceMin,
      priceMax: summary.priceMax,
      stockTotal: summary.stockTotal,
    }))
    .filter((group) => group.product);

  return {
    products: groups.map((group) => buildGroupedStorefrontProduct(group, language)),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
  };
}

productListRouter.get("/featured-categories", async (request, response, next) => {
  try {
    const language = normalizeStorefrontLanguage(request.query.language);
    const cjConfigured = isCjConfigured();
    const cacheKey = `${cjConfigured ? "cj" : "legacy"}:${language}`;
    const cached = getCachedFeaturedCategories(cacheKey);

    if (cached) {
      response.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      return response.json(cached);
    }

    const filter = {
      isActive: true,
      source: { $in: cjConfigured ? ["cj"] : LEGACY_SOURCES },
      stock: { $gt: 0 },
      categoryKey: { $in: [...new Set(Object.values(CATEGORY_GROUPS).flat())] },
    };
    const rows = await Product.find(filter)
      .select("_id key categoryKey supplierProductId variantGroupKey price popularity createdAt stock hasVideo")
      .lean();
    const summariesByGroup = new Map();
    const representativeIds = new Set();

    for (const [groupKey, sourceKeys] of Object.entries(CATEGORY_GROUPS)) {
      const sourceKeySet = new Set(sourceKeys);
      const summaries = buildCatalogGroupSummaries(
        rows.filter((row) => sourceKeySet.has(String(row?.categoryKey || ""))),
        "popular",
      );
      summariesByGroup.set(groupKey, summaries);
      for (const summary of summaries.slice(0, FEATURED_CATEGORY_CANDIDATE_LIMIT)) {
        representativeIds.add(summary.representative._id);
      }
    }

    const representativeProducts = await Product.find({ _id: { $in: [...representativeIds] } })
      .select(STOREFRONT_PRIVATE_FIELDS)
      .lean();
    const productsById = new Map(
      representativeProducts.map((product) => [String(product._id), product]),
    );
    const categories = {};

    for (const [groupKey, summaries] of summariesByGroup) {
      const candidates = summaries
        .slice(0, FEATURED_CATEGORY_CANDIDATE_LIMIT)
        .map((summary) => ({
          summary,
          product: productsById.get(String(summary.representative._id)),
        }))
        .filter(({ product }) => product);
      const imageCandidates = candidates.filter(({ product }) => hasProductImage(product));
      const chosen = [...imageCandidates, ...candidates.filter(({ product }) => !hasProductImage(product))]
        .slice(0, FEATURED_CATEGORY_PREVIEW_LIMIT);

      categories[groupKey] = {
        total: summaries.length,
        products: chosen.map(({ product, summary }) =>
          buildGroupedStorefrontProduct({
            product,
            variantCount: summary.variantCount,
            priceMin: summary.priceMin,
            priceMax: summary.priceMax,
            stockTotal: summary.stockTotal,
          }, language)),
      };
    }

    const payload = { categories, source: cjConfigured ? "cj" : "legacy" };
    cacheFeaturedCategories(cacheKey, payload);
    response.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return response.json(payload);
  } catch (error) {
    return next(error);
  }
});

productListRouter.get("/", async (request, response, next) => {
  try {
    const requestedPage = Number.parseInt(request.query.page, 10) || 1;
    const requestedLimit = Number.parseInt(request.query.limit, 10) || 24;
    const limit = Math.min(Math.max(requestedLimit, 8), 100);
    const search = String(request.query.search || "").trim();
    const category = String(request.query.category || "").trim().toLowerCase();
    const group = String(request.query.group || "").trim();
    const sortMode = String(request.query.sort || "popular").trim().toLowerCase();
    const language = normalizeStorefrontLanguage(request.query.language);
    const cjConfigured = isCjConfigured();
    const filter = {
      isActive: true,
      source: { $in: cjConfigured ? ["cj"] : LEGACY_SOURCES },
      stock: { $gt: 0 },
    };

    if (group && CATEGORY_GROUPS[group]) {
      filter.categoryKey = { $in: CATEGORY_GROUPS[group] };
    } else if (category) {
      filter.categoryKey = category;
    }

    if (search) {
      const searchFields = [
        "key",
        "title",
        "brand",
        "categoryKey",
        "categoryLabel",
        "description",
        "features",
        "supplierProductId",
        "supplierVariantId",
        "supplierSku",
        ...getAllLocalizedSearchFields(),
      ];
      filter.$and = buildCatalogSearchConditions(search, searchFields);
      const exclusions = buildCatalogSearchExclusions(search, searchFields);
      if (exclusions.length) filter.$nor = exclusions;
    }

    if (cjConfigured) {
      const grouped = await getGroupedCjCatalog({
        filter,
        sortMode,
        requestedPage,
        limit,
        language,
      });

      return response.json({
        ...grouped,
        source: "cj",
      });
    }

    const total = await Product.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const page = Math.min(Math.max(requestedPage, 1), totalPages);
    const skip = (page - 1) * limit;
    const sort = sortMode === "newest"
      ? { createdAt: -1, key: 1 }
      : { popularity: -1, createdAt: -1, key: 1 };

    const products = await Product.find(filter)
      .select(STOREFRONT_PRIVATE_FIELDS)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    return response.json({
      products: products.map((product) => trimStorefrontTranslations(product, language)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
      source: "legacy",
    });
  } catch (error) {
    return next(error);
  }
});
