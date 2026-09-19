import { Router } from "express";
import { Product } from "../models/Product.js";
import { isCjConfigured } from "../services/cjApi.js";
import {
  buildCatalogSearchConditions,
  buildCatalogSearchExclusions,
  buildCatalogProductTypeCondition,
  getCatalogSearchRecommendationCategories,
} from "../services/catalogSearch.js";
import {
  buildGroupedStorefrontProduct,
  getLocalizedSearchFields,
  normalizeStorefrontLanguage,
  STOREFRONT_PRIVATE_FIELDS,
  trimStorefrontTranslations,
} from "../services/storefrontProduct.js";
import { withStorefrontResponseCache } from "../services/storefrontResponseCache.js";

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
  supermarketPets: ["pets", "grocery"],
  booksMusicFilmHobby: ["gaming", "hobby"],
};

const FEATURED_CATEGORY_DEFAULT_LIMIT = 3;
const FEATURED_CATEGORY_MAX_LIMIT = 8;
const FEATURED_CATEGORY_CANDIDATE_LIMIT = 8;
const FEATURED_CATEGORY_CACHE_TTL_MS = 2 * 60 * 1000;
const PRODUCT_LIST_CACHE_TTL_MS = 60 * 1000;
const SEARCH_RECOMMENDATION_LIMIT = 8;
const BASE_SEARCH_FIELDS = [
  "key",
  "title",
  "brand",
  "categoryKey",
  "categoryLabel",
];

function hasProductImage(product) {
  return Boolean(
    String(product?.imageUrl || "").trim() ||
    (Array.isArray(product?.images) && product.images.some((image) => String(image || "").trim())),
  );
}

function getSearchFields(language) {
  const languages = [...new Set([normalizeStorefrontLanguage(language), "en"])];
  const localizedFields = languages.flatMap((item) =>
    getLocalizedSearchFields(item).filter((field) => /\.(title|categoryLabel)$/.test(field)),
  );

  return [...new Set([...BASE_SEARCH_FIELDS, ...localizedFields])];
}

function buildCatalogGroupKeyExpression() {
  const supplierProductId = { $ifNull: ["$supplierProductId", ""] };

  // A CJ parent always occupies exactly one storefront card. Color, size,
  // capacity and image differences remain selectable inside product detail.
  return {
    $cond: [
      { $gt: [{ $strLenCP: supplierProductId }, 0] },
      supplierProductId,
      { $ifNull: ["$key", ""] },
    ],
  };
}

function buildCategoryGroupExpression() {
  return {
    $switch: {
      branches: Object.entries(CATEGORY_GROUPS).map(([groupKey, categoryKeys]) => ({
        case: { $in: ["$categoryKey", categoryKeys] },
        then: groupKey,
      })),
      default: null,
    },
  };
}

async function getGroupedCjCatalog({ filter, sortMode, requestedPage, limit, language }) {
  // Group lightweight variant rows in MongoDB so the API does not pull every
  // matching variant into Node before it can return one storefront card.
  // Pick the cheapest representative inside each group with $top instead of
  // globally sorting every matching variant first. This keeps large catalogs
  // under Atlas shared-tier aggregation memory limits.
  const groupSort = sortMode === "newest"
    ? { representativeCreatedAt: -1, representativeKey: 1 }
    : {
        hasVideo: -1,
        representativePopularity: -1,
        representativeCreatedAt: -1,
        representativeKey: 1,
      };

  const summaries = await Product.aggregate([
    { $match: filter },
    {
      $project: {
        key: 1,
        supplierProductId: 1,
        variantGroupKey: 1,
        price: 1,
        popularity: 1,
        createdAt: 1,
        stock: 1,
        hasVideo: 1,
        groupKey: buildCatalogGroupKeyExpression(),
      },
    },
    {
      $group: {
        _id: "$groupKey",
        representative: {
          $top: {
            sortBy: { price: 1, key: 1 },
            output: {
              id: "$_id",
              key: "$key",
              popularity: "$popularity",
              createdAt: "$createdAt",
            },
          },
        },
        variantCount: { $sum: 1 },
        priceMin: { $min: "$price" },
        priceMax: { $max: "$price" },
        stockTotal: { $sum: "$stock" },
        hasVideo: { $max: { $cond: ["$hasVideo", 1, 0] } },
      },
    },
    {
      $project: {
        representativeId: "$representative.id",
        representativeKey: "$representative.key",
        representativePopularity: "$representative.popularity",
        representativeCreatedAt: "$representative.createdAt",
        variantCount: 1,
        priceMin: 1,
        priceMax: 1,
        stockTotal: 1,
        hasVideo: 1,
      },
    },
    { $sort: groupSort },
  ]).allowDiskUse(true);

  const total = summaries.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const skip = (page - 1) * limit;
  const pageSummaries = summaries.slice(skip, skip + limit);
  const representativeIds = pageSummaries.map((summary) => summary.representativeId);
  const representativeProducts = representativeIds.length
    ? await Product.find({ _id: { $in: representativeIds } })
        .select(STOREFRONT_PRIVATE_FIELDS)
        .lean()
    : [];
  const productsById = new Map(
    representativeProducts.map((product) => [String(product._id), product]),
  );
  const groups = pageSummaries
    .map((summary) => ({
      product: productsById.get(String(summary.representativeId)),
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
    const requestedLimit = Number.parseInt(request.query.limit, 10) || FEATURED_CATEGORY_DEFAULT_LIMIT;
    const previewLimit = Math.min(Math.max(requestedLimit, 1), FEATURED_CATEGORY_MAX_LIMIT);
    const cjConfigured = isCjConfigured();
    const cacheKey = `featured-categories:${cjConfigured ? "cj" : "legacy"}:${language}:${previewLimit}`;

    const payload = await withStorefrontResponseCache(
      cacheKey,
      async () => {
        const filter = {
          isActive: true,
          source: { $in: cjConfigured ? ["cj"] : LEGACY_SOURCES },
          stock: { $gt: 0 },
          categoryKey: { $in: [...new Set(Object.values(CATEGORY_GROUPS).flat())] },
        };
        // Collapse variants in MongoDB first. The old implementation loaded every
        // matching CJ variant into Node and re-filtered/re-sorted the same array for
        // each storefront category, which became slow as the catalog grew.
        const groupedRows = await Product.aggregate([
          { $match: filter },
          {
            $project: {
              key: 1,
              categoryKey: 1,
              supplierProductId: 1,
              variantGroupKey: 1,
              price: 1,
              popularity: 1,
              createdAt: 1,
              stock: 1,
              hasVideo: 1,
              categoryGroup: buildCategoryGroupExpression(),
              groupKey: buildCatalogGroupKeyExpression(),
            },
          },
          { $match: { categoryGroup: { $ne: null } } },
          {
            $group: {
              _id: {
                categoryGroup: "$categoryGroup",
                groupKey: "$groupKey",
              },
              representative: {
                $top: {
                  sortBy: { price: 1, key: 1 },
                  output: {
                    id: "$_id",
                    key: "$key",
                    popularity: "$popularity",
                    createdAt: "$createdAt",
                  },
                },
              },
              variantCount: { $sum: 1 },
              priceMin: { $min: "$price" },
              priceMax: { $max: "$price" },
              stockTotal: { $sum: "$stock" },
              hasVideo: { $max: { $cond: ["$hasVideo", 1, 0] } },
            },
          },
          {
            $project: {
              _id: 0,
              categoryGroup: "$_id.categoryGroup",
              representativeId: "$representative.id",
              representativeKey: "$representative.key",
              representativePopularity: "$representative.popularity",
              representativeCreatedAt: "$representative.createdAt",
              variantCount: 1,
              priceMin: 1,
              priceMax: 1,
              stockTotal: 1,
              hasVideo: 1,
            },
          },
          {
            $sort: {
              categoryGroup: 1,
              hasVideo: -1,
              representativePopularity: -1,
              representativeCreatedAt: -1,
              representativeKey: 1,
            },
          },
        ]).allowDiskUse(true);

        const summariesByGroup = new Map(
          Object.keys(CATEGORY_GROUPS).map((groupKey) => [groupKey, []]),
        );
        const totalsByGroup = new Map(
          Object.keys(CATEGORY_GROUPS).map((groupKey) => [groupKey, 0]),
        );
        const representativeIds = new Set();

        for (const summary of groupedRows) {
          const groupKey = String(summary.categoryGroup || "");
          if (!summariesByGroup.has(groupKey)) continue;

          totalsByGroup.set(groupKey, (totalsByGroup.get(groupKey) || 0) + 1);
          const summaries = summariesByGroup.get(groupKey);
          if (summaries.length >= FEATURED_CATEGORY_CANDIDATE_LIMIT) continue;

          summaries.push(summary);
          representativeIds.add(summary.representativeId);
        }

        const representativeProducts = representativeIds.size
          ? await Product.find({ _id: { $in: [...representativeIds] } })
              .select(STOREFRONT_PRIVATE_FIELDS)
              .lean()
          : [];
        const productsById = new Map(
          representativeProducts.map((product) => [String(product._id), product]),
        );
        const categories = {};
        let total = 0;

        for (const groupKey of Object.keys(CATEGORY_GROUPS)) {
          const summaries = summariesByGroup.get(groupKey) || [];
          const groupTotal = totalsByGroup.get(groupKey) || 0;
          total += groupTotal;

          const candidates = summaries
            .map((summary) => ({
              summary,
              product: productsById.get(String(summary.representativeId)),
            }))
            .filter(({ product }) => product);
          const imageCandidates = candidates.filter(({ product }) => hasProductImage(product));
          const chosen = [...imageCandidates, ...candidates.filter(({ product }) => !hasProductImage(product))]
            .slice(0, previewLimit);

          categories[groupKey] = {
            total: groupTotal,
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

        return { categories, total, source: cjConfigured ? "cj" : "legacy" };
      },
      { ttlMs: FEATURED_CATEGORY_CACHE_TTL_MS },
    );

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
    const includeRecommendations = String(request.query.recommendations ?? "1") !== "0";
    const cjConfigured = isCjConfigured();
    const searchFields = getSearchFields(language);
    const cacheKey = `product-list:${JSON.stringify({
      source: cjConfigured ? "cj" : "legacy",
      requestedPage,
      limit,
      search,
      category,
      group,
      sortMode,
      language,
      includeRecommendations,
    })}`;

    const payload = await withStorefrontResponseCache(
      cacheKey,
      async () => {
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
          filter.$and = buildCatalogSearchConditions(search, searchFields);
          const productTypeCondition = buildCatalogProductTypeCondition(search, searchFields);
          if (productTypeCondition) filter.$and.push(productTypeCondition);
          const exclusions = buildCatalogSearchExclusions(search, searchFields);
          if (exclusions.length) filter.$nor = exclusions;
        }

        if (cjConfigured) {
          const profileRecommendationCategories = includeRecommendations && search && requestedPage === 1
            ? getCatalogSearchRecommendationCategories(search)
            : [];
          const groupedPromise = getGroupedCjCatalog({
            filter,
            sortMode,
            requestedPage,
            limit,
            language,
          });
          const profileRecommendationPromise = profileRecommendationCategories.length
            ? getGroupedCjCatalog({
                filter: {
                  isActive: true,
                  source: { $in: ["cj"] },
                  stock: { $gt: 0 },
                  categoryKey: { $in: profileRecommendationCategories },
                  $nor: [buildCatalogProductTypeCondition(search, searchFields)].filter(Boolean),
                },
                sortMode: "popular",
                requestedPage: 1,
                limit: SEARCH_RECOMMENDATION_LIMIT,
                language,
              })
            : Promise.resolve(null);

          const grouped = await groupedPromise;
          let recommendationResult = await profileRecommendationPromise;

          if (
            includeRecommendations &&
            search &&
            requestedPage === 1 &&
            !recommendationResult
          ) {
            const recommendationCategories = [...new Set(
              grouped.products.map((product) => product.categoryKey).filter(Boolean),
            )];

            if (recommendationCategories.length) {
              recommendationResult = await getGroupedCjCatalog({
                filter: {
                  isActive: true,
                  source: { $in: ["cj"] },
                  stock: { $gt: 0 },
                  categoryKey: { $in: recommendationCategories },
                  $nor: [buildCatalogProductTypeCondition(search, searchFields)].filter(Boolean),
                },
                sortMode: "popular",
                requestedPage: 1,
                limit: SEARCH_RECOMMENDATION_LIMIT,
                language,
              });
            }
          }

          return {
            ...grouped,
            recommendations: recommendationResult?.products || [],
            source: "cj",
          };
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

        let recommendations = [];
        if (includeRecommendations && search && requestedPage === 1) {
          const recommendationCategories = [...new Set([
            ...products.map((product) => product.categoryKey).filter(Boolean),
            ...getCatalogSearchRecommendationCategories(search),
          ])];

          if (recommendationCategories.length) {
            const recommendationFilter = {
              isActive: true,
              source: { $in: LEGACY_SOURCES },
              stock: { $gt: 0 },
              categoryKey: { $in: recommendationCategories },
              $nor: [buildCatalogProductTypeCondition(search, searchFields)].filter(Boolean),
            };
            const recommendationProducts = await Product.find(recommendationFilter)
              .select(STOREFRONT_PRIVATE_FIELDS)
              .sort({ popularity: -1, createdAt: -1, key: 1 })
              .limit(SEARCH_RECOMMENDATION_LIMIT)
              .lean();
            recommendations = recommendationProducts.map((product) =>
              trimStorefrontTranslations(product, language));
          }
        }

        return {
          products: products.map((product) => trimStorefrontTranslations(product, language)),
          recommendations,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasPreviousPage: page > 1,
            hasNextPage: page < totalPages,
          },
          source: "legacy",
        };
      },
      { ttlMs: PRODUCT_LIST_CACHE_TTL_MS },
    );

    response.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return response.json(payload);
  } catch (error) {
    return next(error);
  }
});
