import { Router } from "express";
import { Product } from "../models/Product.js";

export const productListRouter = Router();

const QUALITY_SOURCE = "amazon-reviews-2023";
const STOREFRONT_SOURCES = [QUALITY_SOURCE, "manual"];
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
const SHOWCASE_CATEGORIES = [
  "electronics",
  "mobile",
  "home",
  "gaming",
  "appliances",
  "tools",
  "sports",
  "office",
];
const SHOWCASE_EXCLUDED_TITLE_PATTERN = new RegExp(
  "\\b(slippers?|flip[-\\s]?flops?|sandals?|insoles?|shoe\\s+inserts?|refills?|stickers?|decals?|screen\\s+protectors?|phone\\s+cases?|watch\\s+bands?|ear\\s+tips?|replacement\\s+(parts?|filters?|bags?))\\b",
  "i",
);

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
    const filter = {
      isActive: true,
      source: { $in: STOREFRONT_SOURCES },
    };

    if (sortMode === "showcase") {
      filter.categoryKey = { $in: SHOWCASE_CATEGORIES };
      filter.rating = { $gte: 4.2 };
      filter.reviewCount = { $gte: 100 };
      filter.price = { $gte: 20 };
      filter["images.1"] = { $exists: true };
      filter.title = { $not: SHOWCASE_EXCLUDED_TITLE_PATTERN };
      filter.$expr = { $gt: ["$oldPrice", "$price"] };
    } else if (group && CATEGORY_GROUPS[group]) {
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
      ];
    }

    const total = await Product.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const page = Math.min(Math.max(requestedPage, 1), totalPages);
    const skip = (page - 1) * limit;

    const sort =
      sortMode === "newest"
        ? { createdAt: -1, key: 1 }
        : { popularity: -1, rating: -1, reviewCount: -1, key: 1 };

    const products = await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    response.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});
