import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { Product } from "../models/Product.js";

export const adminProductCreateRouter = Router();

const productBadges = ["sale", "new", "stock", null];

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeProductKey(value) {
  return String(value || "").trim().toLowerCase();
}

adminProductCreateRouter.post("/", requireAdmin, async (request, response, next) => {
  try {
    const body = request.body || {};
    const key = normalizeProductKey(body.key);
    const title = String(body.title || "").trim();
    const categoryKey = String(body.categoryKey || "").trim().toLowerCase();
    const price = Number(body.price);
    const stock = body.stock === undefined || body.stock === "" ? 100 : Number(body.stock);

    if (!key || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) {
      throw createHttpError("Product key must use lowercase letters, numbers and hyphens only.", 400);
    }

    if (!title) {
      throw createHttpError("Product title is required.", 400);
    }

    if (!categoryKey) {
      throw createHttpError("Product category is required.", 400);
    }

    if (!Number.isFinite(price) || price < 0) {
      throw createHttpError("Product price must be a non-negative number.", 400);
    }

    if (!Number.isFinite(stock) || stock < 0) {
      throw createHttpError("Product stock must be a non-negative number.", 400);
    }

    let oldPrice = null;
    if (body.oldPrice !== undefined && body.oldPrice !== null && body.oldPrice !== "") {
      oldPrice = Number(body.oldPrice);
      if (!Number.isFinite(oldPrice) || oldPrice < 0) {
        throw createHttpError("Old price must be a non-negative number.", 400);
      }
    }

    const badge = body.badge === "" || body.badge === undefined ? null : body.badge;
    if (!productBadges.includes(badge)) {
      throw createHttpError("Invalid product badge.", 400);
    }

    const existingProduct = await Product.exists({ key });
    if (existingProduct) {
      throw createHttpError("A product with this key already exists.", 409);
    }

    const product = await Product.create({
      key,
      title,
      categoryKey,
      price,
      oldPrice,
      badge,
      image: String(body.image || "🛍️").trim() || "🛍️",
      imageUrl: String(body.imageUrl || "").trim(),
      images: Array.isArray(body.images)
        ? body.images.map((item) => String(item).trim()).filter(Boolean)
        : [],
      stock,
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    });

    response.status(201).json({ product: product.toObject() });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError("A product with this key already exists.", 409));
    }

    return next(error);
  }
});
