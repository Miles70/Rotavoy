import { Router } from "express";
import { Product } from "../models/Product.js";

export const productsRouter = Router();

productsRouter.get("/", async (request, response, next) => {
  try {
    const category = String(request.query.category || "").trim();
    const filter = { isActive: true };

    if (category) {
      filter.categoryKey = category;
    }

    const products = await Product.find(filter).sort({ createdAt: 1 }).lean();

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
    }).lean();

    if (!product) {
      return response.status(404).json({ message: "Product not found." });
    }

    return response.json({ product });
  } catch (error) {
    return next(error);
  }
});
