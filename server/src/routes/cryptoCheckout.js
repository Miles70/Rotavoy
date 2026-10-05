import { bookingStay } from "../services/bookingStay.js";
import crypto from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getPublicCryptoPaymentConfig,
  normalizeCryptoAsset,
  normalizeCryptoNetwork,
} from "../config/cryptoPayment.js";
import { TravelBooking } from "../models/TravelBooking.js";
import { createCryptoPaymentQuote } from "../services/cryptoQuote.js";
import { prebookNuiteeRate } from "../services/nuiteeApi.js";

export const cryptoCheckoutRouter = Router();

const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many hotel booking attempts. Please try again later.",
  },
});

function requestError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function requiredText(value, fieldName, maxLength = 255) {
  const text = String(value || "").trim();

  if (!text || text.length > maxLength) {
    throw requestError(
      `${fieldName} is required and must be at most ${maxLength} characters.`
    );
  }

  return text;
}

function optionalText(value, maxLength = 255) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : "";
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed)
    ? Math.min(Math.max(parsed, min), max)
    : fallback;
}

function normalizePerson(value, fieldName, includeOccupancy = false) {
  const person = {
    firstName: requiredText(value?.firstName, `${fieldName}.firstName`, 100),
    lastName: requiredText(value?.lastName, `${fieldName}.lastName`, 100),
    email: requiredText(value?.email, `${fieldName}.email`, 254).toLowerCase(),
  };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)) {
    throw requestError(`${fieldName}.email is invalid.`);
  }

  const phone = optionalText(value?.phone, 40);
  if (phone) person.phone = phone;

  if (includeOccupancy) {
    person.occupancyNumber = boundedInteger(
      value?.occupancyNumber,
      0,
      1,
      8
    );
    if (!person.occupancyNumber) {
      throw requestError(
        `${fieldName}.occupancyNumber must be between 1 and 8.`
      );
    }
  }

  return person;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function travelReference() {
  return `TRV-${new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function travelBookingPayload(booking) {
  return {
    id: booking.clientReference,
    clientReference: booking.clientReference,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    payment: booking.payment || {},
    total: booking.total,
    currency: booking.currency,
    customer: {
      fullName: `${booking.holder?.firstName || ""} ${
        booking.holder?.lastName || ""
      }`.trim(),
      email: booking.holder?.email || "",
    },
    reservation: booking.providerBooking || {},
  };
}

cryptoCheckoutRouter.post(
  "/crypto-checkout",
  bookingLimiter,
  async (request, response, next) => {
    try {
      const guests = Array.isArray(request.body?.guests)
        ? request.body.guests.map((guest, index) =>
            normalizePerson(guest, `guests[${index}]`, true)
          )
        : [];

      if (!guests.length || guests.length > 20) {
        throw requestError(
          "guests must contain between 1 and 20 entries."
        );
      }

      const holder = normalizePerson(request.body?.holder, "holder");
      const offerId = requiredText(
        request.body?.offerId,
        "offerId",
        5000
      );
      const cryptoAsset = normalizeCryptoAsset(
        request.body?.cryptoAsset || "USDT"
      );

      if (!cryptoAsset) {
        throw requestError(
          "cryptoAsset must be one of USDT, USDC, BNB or ETH."
        );
      }

      const cryptoNetwork = normalizeCryptoNetwork(
        request.body?.cryptoNetwork,
        cryptoAsset
      );

      if (!cryptoNetwork) {
        throw requestError(
          "Selected crypto asset is not available on that network."
        );
      }

      const prebook = await prebookNuiteeRate({
        offerId,
        usePaymentSdk: false,
      });
      const prebookData = prebook?.data || {};
      const prebookId = requiredText(
        prebookData?.prebookId || prebookData?.id,
        "prebookId",
        500
      );
      const providerTotal = Number(prebookData?.price);
      const currency = String(prebookData?.currency || "USD").toUpperCase();

      if (!Number.isFinite(providerTotal) || providerTotal <= 0) {
        throw requestError("The hotel price could not be confirmed.");
      }
      if (currency !== "USD") {
        throw requestError(
          "Hotel crypto checkout currently requires a USD rate."
        );
      }

      const customerTotal = roundMoney(providerTotal);
      const payment = getPublicCryptoPaymentConfig(
        cryptoAsset,
        cryptoNetwork
      );

      if (!payment.configured) {
        const error = new Error(
          `${cryptoAsset} payment on ${cryptoNetwork} is not configured on the server.`
        );
        error.statusCode = 503;
        throw error;
      }

      const quote = await createCryptoPaymentQuote({
        asset: cryptoAsset,
        usdAmount: customerTotal,
      });
      const paymentExpiresAt = new Date(Date.now() + 20 * 60 * 1000);

      const booking = await TravelBooking.create({
      stay: bookingStay(request.body?.stay),
        clientReference: travelReference(),
        offerId,
        prebookId,
        holder,
        guests,
        total: customerTotal,
        currency,
        payment: {
          ...payment,
          expectedAmount: quote.expectedAmount,
          currency: cryptoAsset,
          quoteUsdPrice: quote.usdPrice,
          quoteSource: quote.quoteSource,
          quotedAt: quote.quotedAt,
          quoteExpiresAt: paymentExpiresAt.toISOString(),
        },
        paymentExpiresAt,
      });

      response.set("Cache-Control", "no-store");
      response.status(201).json({
        booking: travelBookingPayload(booking),
      });
    } catch (error) {
      next(error);
    }
  }
);
