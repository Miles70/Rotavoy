import { Router } from "express";
import { Product } from "../models/Product.js";
import {
  applyCachedCatalogTranslation,
  normalizeCatalogLanguage,
} from "../services/catalogTranslation.js";

export const productsRouter = Router();

function toBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSort(sortValue) {
  switch (sortValue) {
    case "price-asc":
      return { price: 1, _id: 1 };
    case "price-desc":
      return { price: -1, _id: 1 };
    case "newest":
      return { createdAt: -1, _id: 1 };
    case "popular":
    default:
      return { popularity: -1, rating: -1, _id: 1 };
  }
}

productsRouter.get("/categories", async (request, response, next) => {
  try {
    const language = normalizeCatalogLanguage(request.query.lang);
    const categories = await Product.aggregate([
      { $match: { isActive: true } },
      { $sort: { popularity: -1, _id: 1 } },
      {
        $group: {
          _id: "$categoryKey",
          title: { $first: "$categoryLabel" },
          count: { $sum: 1 },
          previewProducts: { $push: "$$ROOT" },
        },
      },
      {
        $project: {
          _id: 0,
          key: "$_id",
          title: { $ifNull: ["$title", "$_id"] },
          count: 1,
          previewProducts: { $slice: ["$previewProducts", 3] },
        },
      },
      { $sort: { count: -1, key: 1 } },
    ]);

    const localizedCategories = categories.map((category) => {
      const previewProducts = category.previewProducts.map((product) =>
        applyCachedCatalogTranslation(product, language)
      );
      const translatedCategoryTitle =
        previewProducts.find(
          (product) => product.translationLanguage === language
        )?.categoryLabel || category.title;

      return {
        ...category,
        title: translatedCategoryTitle,
        previewProducts,
      };
    });

    response.json({ categories: localizedCategories });
  } catch (error) {
    next(error);
  }
});

productsRouter.get("/", async (request, response, next) => {
  try {
    const page = toBoundedInteger(request.query.page, 1, 1, 100000);
    const limit = toBoundedInteger(request.query.limit, 24, 1, 100);
    const category = String(request.query.category || "").trim();
    const search = String(request.query.search || "").trim();
    const sort = String(request.query.sort || "popular").trim();
    const language = normalizeCatalogLanguage(request.query.lang);
    const filter = { isActive: true };

    if (category) filter.categoryKey = category;

    if (search) {
      const pattern = new RegExp(escapeRegExp(search), "i");
      filter.$or = [
        { title: pattern },
        { brand: pattern },
        { categoryLabel: pattern },
        { description: pattern },
        { [`translations.${language}.title`]: pattern },
        { [`translations.${language}.description`]: pattern },
      ];
    }

    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(buildSort(sort))
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const localizedProducts = products.map((product) =>
      applyCachedCatalogTranslation(product, language)
    );

    response.json({
      products: localizedProducts,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

productsRouter.get("/:productKey", async (request, response, next) => {
  try {
    const language = normalizeCatalogLanguage(request.query.lang);
    const product = await Product.findOne({
      key: request.params.productKey,
      isActive: true,
    }).lean();

    if (!product) {
      return response.status(404).json({ message: "Product not found." });
    }

    return response.json({
      product: applyCachedCatalogTranslation(product, language),
    });
  } catch (error) {
    return next(error);
  }
});
