import { Router } from "express";
import rateLimit from "express-rate-limit";
import { optionalCustomer } from "../middleware/customerAuth.js";
import { Order } from "../models/Order.js";
import { fulfillPaidOrder } from "../services/cjFulfillment.js";
import { getCompatibleOrderNumbers } from "../services/orderNumberMigration.js";
import {
  createOrder,
  getOrderShippingQuote,
  serializeOrder,
} from "../services/orderService.js";
import { verifyCryptoPayment } from "../services/paymentVerification.js";

export const ordersRouter = Router();

const createOrderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many order attempts. Please try again later." },
});

const shippingQuoteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many shipping quote requests. Please try again later." },
});

const verifyPaymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many payment checks. Please try again later." },
});

ordersRouter.post(
  "/shipping-quote",
  shippingQuoteLimiter,
  async (request, response, next) => {
    try {
      const quote = await getOrderShippingQuote(request.body || {});
      return response.json({ quote });
    } catch (error) {
      return next(error);
    }
  },
);

ordersRouter.post(
  "/",
  createOrderLimiter,
  optionalCustomer,
  async (request, response, next) => {
    try {
      const order = await createOrder(request.body);

      if (request.customer) {
        await Order.updateOne(
          { _id: order.databaseId },
          { $set: { customerAccount: request.customer._id } },
        );
      }

      response.status(201).json({ order });
    } catch (error) {
      next(error);
    }
  },
);

ordersRouter.post(
  "/:orderNumber/verify-payment",
  verifyPaymentLimiter,
  async (request, response, next) => {
    try {
      const email = String(request.body?.email || "").trim().toLowerCase();
      const transactionHash = String(
        request.body?.transactionHash || "",
      ).trim();
      const payerAddress = String(request.body?.payerAddress || "").trim();

      if (!email) {
        return response.status(400).json({ message: "Email is required." });
      }

      if (!transactionHash) {
        return response
          .status(400)
          .json({ message: "Transaction hash is required." });
      }

      const order = await Order.findOne({
        orderNumber: {
          $in: getCompatibleOrderNumbers(request.params.orderNumber),
        },
        "customer.email": email,
      });

      if (!order) {
        return response.status(404).json({ message: "Order not found." });
      }

      const verifiedOrder = await verifyCryptoPayment({
        order,
        transactionHash,
        payerAddress,
      });
      const fulfilledOrder = await fulfillPaidOrder(verifiedOrder);

      return response.json({ order: serializeOrder(fulfilledOrder) });
    } catch (error) {
      return next(error);
    }
  },
);

ordersRouter.get("/:orderNumber", async (request, response, next) => {
  try {
    const email = String(request.query.email || "").trim().toLowerCase();

    if (!email) {
      return response.status(400).json({ message: "Email is required." });
    }

    const order = await Order.findOne({
      orderNumber: {
        $in: getCompatibleOrderNumbers(request.params.orderNumber),
      },
      "customer.email": email,
    });

    if (!order) {
      return response.status(404).json({ message: "Order not found." });
    }

    return response.json({ order: serializeOrder(order) });
  } catch (error) {
    return next(error);
  }
});
