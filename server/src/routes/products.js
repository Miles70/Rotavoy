import { Router } from "express";
import { Product } from "../models/Product.js";
import { isCjConfigured } from "../services/cjApi.js";
import {
  normalizeStorefrontLanguage,
  STOREFRONT_PRIVATE_FIELDS,
  trimStorefrontTranslations,
} from "../services/storefrontProduct.js";

export const productsRouter = Router();

const LEGACY_SOURCES = ["amazon-reviews-2023", "manual"];

function getStorefrontSources() {
  return isCjConfigured() ? ["cj"] : LEGACY_SOURCES;
}

productsRouter.get("/", async (request, response, next) => {
  try {
    const category = String(request.query.category || "").trim();
    const language = normalizeStorefrontLanguage(request.query.language);
    const filter = {
      isActive: true,
      source: { $in: getStorefrontSources() },
      stock: { $gt: 0 },
    };

    if (category) filter.categoryKey = category;

    const products = await Product.find(filter)
      .select(STOREFRONT_PRIVATE_FIELDS)
      .sort({ popularity: -1, createdAt: -1 })
      .limit(100)
      .lean();

    response.json({
      products: products.map((product) => trimStorefrontTranslations(product, language)),
    });
  } catch (error) {
    next(error);
  }
});

productsRouter.get("/:productKey", async (request, response, next) => {
  try {
    const language = normalizeStorefrontLanguage(request.query.language);
    const storefrontSources = getStorefrontSources();
    const product = await Product.findOne({
      key: request.params.productKey,
      isActive: true,
      source: { $in: storefrontSources },
    })
      .select(STOREFRONT_PRIVATE_FIELDS)
      .lean();

    if (!product) {
      return response.status(404).json({ message: "Product not found." });
    }

    let variants = [];
    if (product.source === "cj" && product.supplierProductId) {
      variants = await Product.find({
        source: "cj",
        supplierProductId: product.supplierProductId,
        isActive: true,
        stock: { $gt: 0 },
      })
        .select(STOREFRONT_PRIVATE_FIELDS)
        .sort({ price: 1, key: 1 })
        .lean();
    }

    return response.json({
      product: trimStorefrontTranslations(product, language),
      variants: variants.map((variant) => trimStorefrontTranslations(variant, language)),
    });
  } catch (error) {
    return next(error);
  }
});
