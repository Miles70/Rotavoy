import { Router } from "express";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";

import { TravelBooking } from "../models/TravelBooking.js";
import {
  bookNuiteeTransaction,
  getNuiteeStatus,
  prebookNuiteeRate,
} from "../services/nuiteeApi.js";

export const cardPaymentsRouter = Router();

const cardPaymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many card payment attempts. Please try again later." },
});

function requestError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requiredText(value, fieldName, maxLength = 255) {
  const text = String(value || "").trim();
  if (!text || text.length > maxLength) {
    throw requestError(`${fieldName} is required and must be at most ${maxLength} characters.`);
  }
  return text;
}

function optionalText(value, maxLength = 255) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : "";
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
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
  const remarks = optionalText(value?.remarks, 500);
  if (phone) person.phone = phone;
  if (remarks) person.remarks = remarks;

  if (includeOccupancy) {
    person.occupancyNumber = boundedInteger(value?.occupancyNumber, 0, 1, 8);
    if (!person.occupancyNumber) {
      throw requestError(`${fieldName}.occupancyNumber must be between 1 and 8.`);
    }
  }

  return person;
}

function singleRoomGuests(value) {
  const guests = Array.isArray(value) ? value : [];
  const primaryGuest =
    guests.find((guest) => Number(guest?.occupancyNumber) === 1) || guests[0];

  if (!primaryGuest) {
    throw requestError("A primary guest is required for room 1.");
  }

  // Rotavoy's current hotel search creates exactly one occupancy (one room).
  // LiteAPI expects one primary guest per room, not one guest object per adult.
  return [{
    ...primaryGuest,
    occupancyNumber: 1,
  }];
}

function sanitizeProviderResponse(value) {
  if (Array.isArray(value)) return value.map(sanitizeProviderResponse);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          ![
            "secretKey",
            "transactionId",
            "paymentIntent",
            "clientSecret",
            "commission",
            "providerCommission",
            "supplier",
            "supplierId",
          ].includes(key),
      )
      .map(([key, nestedValue]) => [key, sanitizeProviderResponse(nestedValue)]),
  );
}

function travelReference() {
  return `TRV-CARD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function publicBooking(booking) {
  return {
    id: booking.clientReference,
    clientReference: booking.clientReference,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    payment: {
      method: "card",
      provider: "nuitee",
    },
    total: booking.total,
    currency: booking.currency,
    customer: {
      fullName: `${booking.holder?.firstName || ""} ${booking.holder?.lastName || ""}`.trim(),
      email: booking.holder?.email || "",
    },
    reservation: sanitizeProviderResponse(booking.providerBooking || {}),
  };
}

cardPaymentsRouter.post("/session", cardPaymentLimiter, async (request, response, next) => {
  try {
    const status = getNuiteeStatus();
    if (!status.configured || status.environment === "unconfigured") {
      throw requestError("Nuitee Connect is not configured.", 503);
    }

    const holder = normalizePerson(request.body?.holder, "holder");
    const guests = Array.isArray(request.body?.guests)
      ? request.body.guests.map((guest, index) =>
          normalizePerson(guest, `guests[${index}]`, true),
        )
      : [];

    if (!guests.length || guests.length > 20) {
      throw requestError("guests must contain between 1 and 20 entries.");
    }

    const bookingGuests = singleRoomGuests(guests);
    const offerId = requiredText(request.body?.offerId, "offerId", 5000);
    const prebook = await prebookNuiteeRate({ offerId, usePaymentSdk: true });
    const data = prebook?.data || {};

    const prebookId = requiredText(data.prebookId || data.id, "prebookId", 500);
    const transactionId = requiredText(data.transactionId, "transactionId", 500);
    const secretKey = requiredText(data.secretKey, "secretKey", 1000);
    const total = Number(data.price);
    const currency = String(data.currency || "USD").toUpperCase();

    if (!Number.isFinite(total) || total <= 0) {
      throw requestError("The card payment amount could not be confirmed.");
    }

    const clientReference = travelReference();
    const booking = await TravelBooking.create({
      clientReference,
      offerId,
      prebookId,
      holder,
      guests: bookingGuests,
      total,
      currency,
      status: "awaiting_payment",
      paymentStatus: "pending",
      payment: {
        method: "card",
        provider: "nuitee",
        transactionId,
      },
      paymentExpiresAt: new Date(Date.now() + 55 * 60 * 1000),
    });

    response.set("Cache-Control", "no-store");
    return response.status(201).json({
      booking: publicBooking(booking),
      paymentSession: {
        secretKey,
        environment: status.environment === "sandbox" ? "sandbox" : "live",
        clientReference,
        amount: total,
        currency,
      },
    });
  } catch (error) {
    next(error);
  }
});

cardPaymentsRouter.post(
  "/:clientReference/finalize",
  cardPaymentLimiter,
  async (request, response, next) => {
    try {
      const clientReference = requiredText(
        request.params.clientReference,
        "clientReference",
        120,
      );
      const booking = await TravelBooking.findOne({ clientReference });

      if (!booking) {
        return response.status(404).json({ message: "Card booking session not found." });
      }

      if (booking.payment?.method !== "card") {
        throw requestError("This booking is not a card payment session.");
      }

      if (booking.status === "confirmed") {
        response.set("Cache-Control", "no-store");
        return response.json({ booking: publicBooking(booking) });
      }

      const transactionId = requiredText(
        booking.payment?.transactionId,
        "transactionId",
        500,
      );
      const bookingGuests = singleRoomGuests(booking.guests);

      booking.status = "processing";
      booking.failureReason = "";
      await booking.save();

      try {
        const result = await bookNuiteeTransaction({
          prebookId: booking.prebookId,
          clientReference,
          holder: booking.holder,
          guests: bookingGuests,
          transactionId,
        });

        booking.guests = bookingGuests;
        booking.status = "confirmed";
        booking.paymentStatus = "paid";
        booking.providerBooking = sanitizeProviderResponse(result);
        booking.paymentExpiresAt = null;
        booking.failureReason = "";
        booking.payment = {
          ...booking.payment,
          completedAt: new Date().toISOString(),
        };
        await booking.save();

        response.set("Cache-Control", "no-store");
        return response.json({ booking: publicBooking(booking) });
      } catch (error) {
        booking.status = "awaiting_payment";
        booking.paymentStatus = "pending";
        booking.failureReason = String(
          error.message || "Card payment was received but booking finalization failed.",
        ).slice(0, 500);
        await booking.save();
        throw error;
      }
    } catch (error) {
      next(error);
    }
  },
);
