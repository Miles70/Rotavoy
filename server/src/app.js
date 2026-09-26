import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { adminRouter } from "./routes/admin.js";
import { adminAnalyticsRouter } from "./routes/adminAnalytics.js";
import {
  adminHomeCampaignRouter,
  homeCampaignRouter,
} from "./routes/homeCampaign.js";
import { adminProductCreateRouter } from "./routes/adminProductCreate.js";
import { adminProductListRouter } from "./routes/adminProductList.js";
import { customerAccountRouter } from "./routes/customerAccount.js";
import { customerAuthRouter } from "./routes/customerAuth.js";
import { hotelsRouter } from "./routes/hotels.js";
import { ordersRouter } from "./routes/orders.js";
import { productListRouter } from "./routes/productList.js";
import { productMediaRouter } from "./routes/productMedia.js";
import { productsRouter } from "./routes/products.js";

function getAllowedOrigins() {
  return String(process.env.CLIENT_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        const error = new Error("Origin is not allowed by CORS.");
        error.statusCode = 403;
        callback(error);
      },
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );

  app.get("/api/health", (request, response) => {
    response.json({
      ok: true,
      service: "rotavoy-api",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/customer-auth", customerAuthRouter);
  app.use("/api/customer", customerAccountRouter);
  app.use("/api/admin/analytics", adminAnalyticsRouter);
  app.use("/api/admin/campaign", adminHomeCampaignRouter);
  app.use("/api/admin/products", adminProductListRouter);
  app.use("/api/admin/products", adminProductCreateRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/campaign", homeCampaignRouter);
  app.use("/api/products", productMediaRouter);
  app.use("/api/products", productListRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/hotels", hotelsRouter);

  app.use((request, response) => {
    response.status(404).json({ message: "API route not found." });
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    const statusCode = Number(error.statusCode) || 500;
    if (statusCode >= 500) {
      console.error(`[${request.method} ${request.originalUrl}]`, error);
    }
    const message =
      statusCode >= 500 && process.env.NODE_ENV === "production"
        ? "Internal server error."
        : error.message || "Internal server error.";

    response.status(statusCode).json({ message });
  });

  return app;
}
