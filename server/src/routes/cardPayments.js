import { guardRateTerms } from "../../../shared/hotelRate.js";
import { createBookingAccess, requireBookingAccess } from "../services/bookingAccess.js";
import { finalizeBooking, bookingPayload } from "../services/finalizeBooking.js";
import { optionalCustomer } from "../middleware/customerAuth.js";
import { bookingStay } from "../services/bookingStay.js";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";

import { TravelBooking } from "../models/TravelBooking.js";
import {
  assertBookingReady,
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

  // Mongoose subdocuments do not reliably preserve schema fields when spread
  // into a plain object. Read the required LiteAPI fields explicitly so the
  // final /rates/book payload always contains the guest identity.
  return [{
    occupancyNumber: 1,
    firstName: requiredText(primaryGuest?.firstName, "guests[0].firstName", 100),
    lastName: requiredText(primaryGuest?.lastName, "guests[0].lastName", 100),
    email: requiredText(primaryGuest?.email, "guests[0].email", 254).toLowerCase(),
    ...(optionalText(primaryGuest?.remarks, 500)
      ? { remarks: optionalText(primaryGuest?.remarks, 500) }
      : {}),
  }];
}

function travelReference() {
  return `TRV-CARD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

const publicBooking = bookingPayload;

cardPaymentsRouter.post("/session", cardPaymentLimiter, optionalCustomer, async (request, response, next) => {
  try {
    const status = assertBookingReady();
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
    if (!guardRateTerms(response, request.body?.acceptedTerms, data)) return;

    const prebookId = requiredText(data.prebookId || data.id, "prebookId", 500);
    const transactionId = requiredText(data.transactionId, "transactionId", 500);
    const secretKey = requiredText(data.secretKey, "secretKey", 1000);
    const total = Number(data.price);
    const currency = String(data.currency || "USD").toUpperCase();

    if (!Number.isFinite(total) || total <= 0) {
      throw requestError("The card payment amount could not be confirmed.");
    }

    const clientReference = travelReference();
    const access = createBookingAccess();
    const booking = await TravelBooking.create({
      accessTokenHash: access.hash,
      customerId: request.customer?._id || null,
      stay: bookingStay(request.body?.stay),
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
      accessToken: access.token,
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
  optionalCustomer,
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

      requireBookingAccess(request, booking);
      if (booking.payment?.method !== 'card' || booking.kind === 'flight') throw requestError('Bu oturum otel kart ödemesi değil.');
      const current = await finalizeBooking(booking);
      response.set('Cache-Control', 'no-store');
      return response.json({ booking: publicBooking(current) });
    } catch (error) {
      next(error);
    }
  },
);
