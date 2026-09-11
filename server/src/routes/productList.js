import { Router } from "express";
import { Product } from "../models/Product.js";
import { isCjConfigured } from "../services/cjApi.js";
import {
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
    const filter = {
      isActive: true,
      source: { $in: getStorefrontSources() },
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

    response.json({
      products: products.map((product) => trimStorefrontTranslations(product, language)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
      source: isCjConfigured() ? "cj" : "legacy",
    });
  } catch (error) {
    next(error);
  }
});
