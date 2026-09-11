import { Router } from "express";
import { Product } from "../models/Product.js";
import { isCjConfigured } from "../services/cjApi.js";

export const productsRouter = Router();

const LEGACY_SOURCES = ["amazon-reviews-2023", "manual"];
const STOREFRONT_PRIVATE_FIELDS = [
  "-costPrice",
  "-supplierContent",
  "-contentMeta",
  "-translationMeta",
  "-sourceHash",
  "-sourceCode",
  "-sourceUrl",
  "-supplierVariantId",
  "-supplierSku",
].join(" ");

function getStorefrontSources() {
  return isCjConfigured() ? ["cj"] : LEGACY_SOURCES;
}

productsRouter.get("/", async (request, response, next) => {
  try {
    const category = String(request.query.category || "").trim();
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

    response.json({ products });
  } catch (error) {
    next(error);
  }
});

productsRouter.get("/:productKey", async (request, response, next) => {
  try {
    const product = await Product.findOne({
      key: request.params.productKey,
      isActive: true,
      source: { $in: getStorefrontSources() },
    })
      .select(STOREFRONT_PRIVATE_FIELDS)
      .lean();

    if (!product) {
      return response.status(404).json({ message: "Product not found." });
    }

    return response.json({ product });
  } catch (error) {
    return next(error);
  }
});
