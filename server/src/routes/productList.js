import { Router } from "express";
import { Product } from "../models/Product.js";
import { isCjConfigured } from "../services/cjApi.js";
import {
  buildGroupedStorefrontProduct,
  getLocalizedSearchFields,
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

function getStorefrontSources() {
  return isCjConfigured() ? ["cj"] : LEGACY_SOURCES;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCjGroupIdExpression() {
  return {
    $cond: [
      {
        $and: [
          { $ne: ["$supplierProductId", null] },
          { $ne: ["$supplierProductId", ""] },
        ],
      },
      "$supplierProductId",
      "$key",
    ],
  };
}

async function getGroupedCjCatalog({ filter, sortMode, requestedPage, limit, language }) {
  const groupId = getCjGroupIdExpression();
  const totalRows = await Product.aggregate([
    { $match: filter },
    { $group: { _id: groupId } },
    { $count: "total" },
  ]);
  const total = Number(totalRows?.[0]?.total || 0);
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const skip = (page - 1) * limit;

  // Keep fulfillment data at variant level, but choose one active variant as the
  // catalog representative. The cheapest active variant is a predictable card
  // entry point; the detail page exposes all active sibling variants.
  const parentSort = sortMode === "newest"
    ? { "product.createdAt": -1, "product.key": 1 }
    : { "product.popularity": -1, "product.createdAt": -1, "product.key": 1 };

  const groups = await Product.aggregate([
    { $match: filter },
    { $sort: { supplierProductId: 1, price: 1, key: 1 } },
    {
      $group: {
        _id: groupId,
        product: { $first: "$$ROOT" },
        variantCount: { $sum: 1 },
        priceMin: { $min: "$price" },
        priceMax: { $max: "$price" },
        stockTotal: { $sum: "$stock" },
      },
    },
    { $sort: parentSort },
    { $skip: skip },
    { $limit: limit },
  ]);

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
      const pattern = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { key: pattern },
        { title: pattern },
        { brand: pattern },
        { categoryKey: pattern },
        { categoryLabel: pattern },
        { description: pattern },
        { supplierSku: pattern },
        ...getLocalizedSearchFields(language).map((field) => ({ [field]: pattern })),
      ];
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
