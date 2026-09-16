import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { Product } from "../models/Product.js";

export const adminProductListRouter = Router();

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

adminProductListRouter.get("/", requireAdmin, async (request, response, next) => {
  try {
    const requestedPage = Number.parseInt(request.query.page, 10) || 1;
    const requestedLimit = Number.parseInt(request.query.limit, 10) || 20;
    const limit = Math.min(Math.max(requestedLimit, 5), 50);
    const search = String(request.query.search || "").trim();
    const category = String(request.query.category || "").trim();
    const source = String(request.query.source || "").trim();
    const status = String(request.query.status || "").trim();
    const stock = String(request.query.stock || "").trim();
    const filter = {};

    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { key: pattern },
        { title: pattern },
        { categoryKey: pattern },
      ];
    }

    if (category) filter.categoryKey = category;
    if (source) filter.source = source;
    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;
    if (stock === "out") filter.stock = 0;
    if (stock === "low") filter.stock = { $gt: 0, $lte: 10 };
    if (stock === "available") filter.stock = { $gt: 10 };

    const [total, catalogTotal, activeTotal, categoryValues, sourceValues] = await Promise.all([
      Product.countDocuments(filter),
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Product.distinct("categoryKey"),
      Product.distinct("source"),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const page = Math.min(Math.max(requestedPage, 1), totalPages);
    const skip = (page - 1) * limit;

    const products = await Product.find(filter)
      .sort({ createdAt: -1, key: 1 })
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
        catalogTotal,
        activeTotal,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
      filters: {
        categories: categoryValues.filter(Boolean).sort(),
        sources: sourceValues.filter(Boolean).sort(),
      },
    });
  } catch (error) {
    next(error);
  }
});
