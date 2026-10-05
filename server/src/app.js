import { flightBookingsRouter } from "./routes/flightBookings.js";
import { reservationsRouter } from "./routes/reservations.js";
import { accountRouter } from "./routes/account.js";
import { adminAuthRouter } from "./routes/adminAuth.js";
import { analyticsRouter } from "./routes/analytics.js";
import { adminRouter } from "./routes/admin.js";
import { flightsRouter } from "./routes/flights.js";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { customerAuthRouter } from "./routes/customerAuth.js";
import { cardPaymentsRouter } from "./routes/cardPayments.js";
import { cryptoCheckoutRouter } from "./routes/cryptoCheckout.js";
import { hotelsRouter } from "./routes/hotels.js";

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
      service: "rotavoy-travel-api",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/visits", analyticsRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/admin-auth", adminAuthRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/account", accountRouter);
  app.use("/api/customer-auth", customerAuthRouter);
  app.use("/api/hotels/card", cardPaymentsRouter);
  app.use("/api/hotels", cryptoCheckoutRouter);
  app.use("/api/hotels", hotelsRouter);
  app.use("/api/reservations", reservationsRouter);
  app.use("/api/flights", flightBookingsRouter);
  app.use("/api/flights", flightsRouter);

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
