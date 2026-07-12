import { Router } from "express";
import { Product } from "../models/Product.js";

export const productListRouter = Router();

const QUALITY_SOURCE = "amazon-reviews-2023";

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
    const filter = {
      isActive: true,
      source: QUALITY_SOURCE,
    };

    if (category) {
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

    const products = await Product.find(filter)
      .sort({ popularity: -1, rating: -1, reviewCount: -1, key: 1 })
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
