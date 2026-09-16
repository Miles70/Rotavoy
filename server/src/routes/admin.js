import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { releaseOrderStock } from "../services/stockReservation.js";
import {
  createAdminToken,
  revokeAdminToken,
  verifyAdminCredentials,
} from "../utils/adminAuth.js";

export const adminRouter = Router();

const orderStatuses = [
  "awaiting_payment",
  "pending",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "expired",
];
const paymentStatuses = ["unpaid", "pending", "paid", "failed", "refunded"];
const paymentMethods = ["not_selected", "card", "crypto"];
const productBadges = ["sale", "new", "stock", null];
const releaseOrderStatuses = new Set(["cancelled", "expired"]);
const commitOrderStatuses = new Set([
  "processing",
  "shipped",
  "delivered",
  "completed",
]);
const releasePaymentStatuses = new Set(["failed", "refunded"]);
const MAX_BULK_ORDER_DELETE = 200;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeOrderNumber(value) {
  return String(value || "").trim().toUpperCase();
}

function shouldReleaseReservation(updates) {
  return (
    releaseOrderStatuses.has(updates.status) ||
    releasePaymentStatuses.has(updates.paymentStatus)
  );
}

function shouldCommitReservation(updates) {
  return (
    updates.paymentStatus === "paid" ||
    commitOrderStatuses.has(updates.status)
  );
}

async function releaseReservedOrdersBeforeDelete(orderNumbers) {
  const orders = await Order.find({
    orderNumber: { $in: orderNumbers },
    stockReserved: true,
    stockCommittedAt: null,
    paymentStatus: { $ne: "paid" },
  });

  for (const order of orders) {
    await releaseOrderStock(order, {
      status: "cancelled",
      paymentStatus: "failed",
    });
  }
}

adminRouter.post("/login", loginLimiter, (request, response, next) => {
  try {
    const { email, password } = request.body || {};

    if (!email || !password) {
      return response.status(400).json({ message: "Email and password are required." });
    }

    if (!verifyAdminCredentials(email, password)) {
      return response.status(401).json({ message: "Email or password is incorrect." });
    }

    const token = createAdminToken();
    return response.json({
      token,
      admin: { email: String(email).trim().toLowerCase() },
    });
  } catch (error) {
    return next(error);
  }
});

adminRouter.use(requireAdmin);

adminRouter.get("/session", (request, response) => {
  response.json({
    admin: { email: request.admin.email },
    session: { expiresAt: new Date(request.admin.exp * 1000).toISOString() },
  });
});

adminRouter.post("/logout", (request, response) => {
  revokeAdminToken(request.adminToken);
  response.json({ loggedOut: true });
});

adminRouter.get("/system-status", async (request, response, next) => {
  try {
    const [products, orders] = await Promise.all([
      Product.estimatedDocumentCount(),
      Order.estimatedDocumentCount(),
    ]);

    response.json({
      api: { ok: true, uptimeSeconds: Math.floor(process.uptime()) },
      database: {
        connected: mongoose.connection.readyState === 1,
        name: mongoose.connection.name || "",
      },
      catalog: { products },
      commerce: { orders },
      configuration: {
        adminAuth: Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD),
        cj: Boolean(process.env.CJ_API_KEY || process.env.CJ_ACCESS_TOKEN),
        crypto: Boolean(process.env.ROTAVOY_PAYMENT_WALLET),
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/dashboard", async (request, response, next) => {
  try {
    const lowStockThreshold = 10;
    const [
      totalProducts,
      activeProducts,
      lowStockProducts,
      totalOrders,
      pendingOrders,
      revenueByCurrency,
      recentOrders,
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: true, stock: { $lte: lowStockThreshold } }),
      Order.countDocuments(),
      Order.countDocuments({
        status: { $in: ["awaiting_payment", "pending", "processing"] },
      }),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        {
          $group: {
            _id: "$currency",
            total: { $sum: "$total" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.find().sort({ createdAt: -1 }).limit(8).lean(),
    ]);

    response.json({
      summary: {
        totalProducts,
        activeProducts,
        lowStockProducts,
        totalOrders,
        pendingOrders,
        revenueByCurrency: revenueByCurrency.map((item) => ({
          currency: item._id || "USD",
          total: item.total,
          count: item.count,
        })),
      },
      recentOrders,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/orders", async (request, response, next) => {
  try {
    const status = String(request.query.status || "").trim();
    const paymentStatus = String(request.query.paymentStatus || "").trim();
    const search = String(request.query.search || "").trim();
    const requestedPage = Number.parseInt(request.query.page, 10) || 1;
    const requestedLimit = Number.parseInt(request.query.limit, 10) || 25;
    const limit = Math.min(Math.max(requestedLimit, 5), 100);
    const filter = {};

    if (status && orderStatuses.includes(status)) {
      filter.status = status;
    }

    if (paymentStatus && paymentStatuses.includes(paymentStatus)) {
      filter.paymentStatus = paymentStatus;
    }

    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { orderNumber: pattern },
        { "customer.fullName": pattern },
        { "customer.email": pattern },
        { "customer.phone": pattern },
      ];
    }

    const total = await Order.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const page = Math.min(Math.max(requestedPage, 1), totalPages);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    response.json({
      orders,
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

adminRouter.delete("/orders", async (request, response, next) => {
  try {
    const orderNumbers = [
      ...new Set(
        (Array.isArray(request.body?.orderNumbers) ? request.body.orderNumbers : [])
          .map(normalizeOrderNumber)
          .filter(Boolean),
      ),
    ];

    if (orderNumbers.length === 0) {
      throw createHttpError("At least one order number is required.", 400);
    }

    if (orderNumbers.length > MAX_BULK_ORDER_DELETE) {
      throw createHttpError(
        `A maximum of ${MAX_BULK_ORDER_DELETE} orders can be deleted at once.`,
        400,
      );
    }

    await releaseReservedOrdersBeforeDelete(orderNumbers);

    const result = await Order.deleteMany({
      orderNumber: { $in: orderNumbers },
    });

    return response.json({
      deletedCount: result.deletedCount || 0,
      orderNumbers,
    });
  } catch (error) {
    return next(error);
  }
});

adminRouter.delete("/orders/:orderNumber", async (request, response, next) => {
  try {
    const orderNumber = normalizeOrderNumber(request.params.orderNumber);

    if (!orderNumber) {
      throw createHttpError("Order number is required.", 400);
    }

    const existingOrder = await Order.findOne({ orderNumber });

    if (!existingOrder) {
      return response.status(404).json({ message: "Order not found." });
    }

    if (
      existingOrder.stockReserved &&
      !existingOrder.stockCommittedAt &&
      existingOrder.paymentStatus !== "paid"
    ) {
      await releaseOrderStock(existingOrder, {
        status: "cancelled",
        paymentStatus: "failed",
      });
    }

    await Order.deleteOne({ _id: existingOrder._id });

    return response.json({
      deleted: true,
      orderNumber: existingOrder.orderNumber,
    });
  } catch (error) {
    return next(error);
  }
});

adminRouter.patch("/orders/:orderNumber", async (request, response, next) => {
  try {
    const orderNumber = normalizeOrderNumber(request.params.orderNumber);
    const updates = {};

    if (request.body?.status !== undefined) {
      if (!orderStatuses.includes(request.body.status)) {
        throw createHttpError("Invalid order status.", 400);
      }
      updates.status = request.body.status;
    }

    if (request.body?.paymentStatus !== undefined) {
      if (!paymentStatuses.includes(request.body.paymentStatus)) {
        throw createHttpError("Invalid payment status.", 400);
      }
      updates.paymentStatus = request.body.paymentStatus;
    }

    if (request.body?.paymentMethod !== undefined) {
      if (!paymentMethods.includes(request.body.paymentMethod)) {
        throw createHttpError("Invalid payment method.", 400);
      }
      updates.paymentMethod = request.body.paymentMethod;
    }

    if (Object.keys(updates).length === 0) {
      throw createHttpError("No valid order fields were provided.", 400);
    }

    const existingOrder = await Order.findOne({ orderNumber });

    if (!existingOrder) {
      return response.status(404).json({ message: "Order not found." });
    }

    if (existingOrder.stockReserved && shouldReleaseReservation(updates)) {
      const releasedOrder = await releaseOrderStock(existingOrder, {
        status: releaseOrderStatuses.has(updates.status)
          ? updates.status
          : "cancelled",
        paymentStatus: releasePaymentStatuses.has(updates.paymentStatus)
          ? updates.paymentStatus
          : "failed",
      });

      if (releasedOrder) {
        const order = await Order.findOneAndUpdate(
          { _id: releasedOrder._id },
          { $set: updates },
          { new: true, runValidators: true },
        ).lean();

        return response.json({ order });
      }
    }

    if (existingOrder.stockReserved && shouldCommitReservation(updates)) {
      const committedAt = new Date();
      const commitUpdates = {
        ...updates,
        stockReserved: false,
        stockCommittedAt: committedAt,
        reservationExpiresAt: null,
      };

      if (
        updates.paymentStatus === "paid" &&
        updates.status === undefined &&
        ["awaiting_payment", "pending"].includes(existingOrder.status)
      ) {
        commitUpdates.status = "processing";
      }

      const committedOrder = await Order.findOneAndUpdate(
        {
          _id: existingOrder._id,
          stockReserved: true,
          stockReleasedAt: null,
          stockCommittedAt: null,
        },
        { $set: commitUpdates },
        { new: true, runValidators: true },
      ).lean();

      if (committedOrder) {
        return response.json({ order: committedOrder });
      }

      const currentOrder = await Order.findById(existingOrder._id).lean();

      if (currentOrder?.stockReleasedAt && !currentOrder.stockCommittedAt) {
        throw createHttpError(
          "The stock reservation was already released. Create a new order before marking it paid.",
          409,
        );
      }
    }

    const order = await Order.findOneAndUpdate(
      { orderNumber },
      { $set: updates },
      { new: true, runValidators: true },
    ).lean();

    if (!order) {
      return response.status(404).json({ message: "Order not found." });
    }

    return response.json({ order });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get("/products", async (request, response, next) => {
  try {
    const products = await Product.find().sort({ createdAt: 1 }).lean();
    response.json({ products });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/products/:productKey", async (request, response, next) => {
  try {
    const updates = {};
    const body = request.body || {};

    for (const field of [
      "title",
      "description",
      "brand",
      "categoryKey",
      "categoryLabel",
      "image",
      "imageUrl",
      "videoUrl",
    ]) {
      if (body[field] !== undefined) {
        updates[field] = String(body[field]).trim();
      }
    }

    if (body.features !== undefined) {
      if (!Array.isArray(body.features)) {
        throw createHttpError("Product features must be an array.", 400);
      }
      updates.features = body.features
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 20);
    }

    if (body.images !== undefined) {
      if (!Array.isArray(body.images)) {
        throw createHttpError("Product images must be an array.", 400);
      }
      updates.images = body.images.map((item) => String(item).trim()).filter(Boolean);
    }

    for (const field of ["price", "stock"]) {
      if (body[field] !== undefined) {
        const value = Number(body[field]);
        if (!Number.isFinite(value) || value < 0) {
          throw createHttpError(`${field} must be a non-negative number.`, 400);
        }
        updates[field] = value;
      }
    }

    if (body.oldPrice !== undefined) {
      if (body.oldPrice === null || body.oldPrice === "") {
        updates.oldPrice = null;
      } else {
        const oldPrice = Number(body.oldPrice);
        if (!Number.isFinite(oldPrice) || oldPrice < 0) {
          throw createHttpError("oldPrice must be a non-negative number.", 400);
        }
        updates.oldPrice = oldPrice;
      }
    }

    if (body.isActive !== undefined) {
      updates.isActive = Boolean(body.isActive);
    }

    if (body.badge !== undefined) {
      const badge = body.badge === "" ? null : body.badge;
      if (!productBadges.includes(badge)) {
        throw createHttpError("Invalid product badge.", 400);
      }
      updates.badge = badge;
    }

    if (Object.keys(updates).length === 0) {
      throw createHttpError("No valid product fields were provided.", 400);
    }

    const product = await Product.findOneAndUpdate(
      { key: request.params.productKey },
      { $set: updates },
      { new: true, runValidators: true },
    ).lean();

    if (!product) {
      return response.status(404).json({ message: "Product not found." });
    }

    return response.json({ product });
  } catch (error) {
    return next(error);
  }
});
