import { Router } from "express";
import { Product } from "../models/Product.js";
import { isCjConfigured } from "../services/cjApi.js";
import {
  buildCatalogGroupSummaries,
  buildGroupedStorefrontProduct,
  normalizeStorefrontLanguage,
  rankRelatedCatalogGroups,
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

productsRouter.get("/:productKey/related", async (request, response, next) => {
  try {
    const language = normalizeStorefrontLanguage(request.query.language);
    const requestedLimit = Number.parseInt(request.query.limit, 10) || 8;
    const limit = Math.min(Math.max(requestedLimit, 1), 12);
    const storefrontSources = getStorefrontSources();
    const product = await Product.findOne({
      key: request.params.productKey,
      isActive: true,
      source: { $in: storefrontSources },
    })
      .select("key source title brand categoryKey supplierProductId variantGroupKey")
      .lean();

    if (!product) {
      return response.status(404).json({ message: "Product not found." });
    }

    const relationshipFilter = {
      isActive: true,
      source: { $in: storefrontSources },
      stock: { $gt: 0 },
      $or: [
        { categoryKey: product.categoryKey },
        ...(product.supplierProductId
          ? [{ supplierProductId: product.supplierProductId }]
          : []),
      ],
    };
    const rows = await Product.find(relationshipFilter)
      .select("_id key title brand categoryKey supplierProductId variantGroupKey price popularity createdAt stock hasVideo")
      .lean();
    const rankedGroups = rankRelatedCatalogGroups(
      product,
      buildCatalogGroupSummaries(rows, "popular"),
      limit,
    );
    const representativeIds = rankedGroups.map((group) => group.representative._id);
    const representatives = await Product.find({ _id: { $in: representativeIds } })
      .select(STOREFRONT_PRIVATE_FIELDS)
      .lean();
    const productsById = new Map(
      representatives.map((item) => [String(item._id), item]),
    );
    const products = rankedGroups
      .map((group) => ({
        group,
        product: productsById.get(String(group.representative._id)),
      }))
      .filter((entry) => entry.product)
      .map(({ group, product: relatedProduct }) => buildGroupedStorefrontProduct({
        product: relatedProduct,
        variantCount: group.variantCount,
        priceMin: group.priceMin,
        priceMax: group.priceMax,
        stockTotal: group.stockTotal,
      }, language));

    return response.json({ products });
  } catch (error) {
    return next(error);
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
      const variantFilter = {
        source: "cj",
        supplierProductId: product.supplierProductId,
        isActive: true,
        stock: { $gt: 0 },
      };
      if (product.variantGroupKey) {
        variantFilter.variantGroupKey = product.variantGroupKey;
      }

      variants = await Product.find(variantFilter)
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
