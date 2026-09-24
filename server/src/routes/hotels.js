import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  bookNuiteeSandbox,
  getNuiteeHotel,
  getNuiteeStatus,
  listNuiteeHotels,
  prebookNuiteeRate,
  searchNuiteeRates,
} from "../services/nuiteeApi.js";
import { getLocalizedHotelDescription } from "../services/hotelTranslation.js";

export const hotelsRouter = Router();

const searchLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many hotel searches. Please try again later." },
});

const translationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many hotel translation requests. Please try again later." },
});

const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many hotel booking attempts. Please try again later." },
});

function requestError(message) {
  const error = new Error(message);
  error.statusCode = 400;
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

function isoCode(value, fieldName, length) {
  const text = requiredText(value, fieldName, length).toUpperCase();

  if (!new RegExp(`^[A-Z]{${length}}$`).test(text)) {
    throw requestError(`${fieldName} must be a ${length}-letter code.`);
  }

  return text;
}

function isoDate(value, fieldName) {
  const text = requiredText(value, fieldName, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw requestError(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw requestError(`${fieldName} is not a valid date.`);
  }

  return text;
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

function normalizeOccupancies(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    throw requestError("occupancies must contain between 1 and 8 rooms.");
  }

  return value.map((occupancy, index) => {
    const adults = boundedInteger(occupancy?.adults, 0, 0, 10);
    if (adults < 1) {
      throw requestError(`occupancies[${index}].adults must be between 1 and 10.`);
    }

    const children = Array.isArray(occupancy?.children)
      ? occupancy.children.map((age) => Number.parseInt(age, 10))
      : [];

    if (
      children.length > 6 ||
      children.some((age) => !Number.isInteger(age) || age < 0 || age > 17)
    ) {
      throw requestError(
        `occupancies[${index}].children must contain up to 6 ages between 0 and 17.`,
      );
    }

    return { adults, ...(children.length ? { children } : {}) };
  });
}

function getMargin() {
  const margin = Number.parseFloat(process.env.NUITEE_DEFAULT_MARGIN_PERCENT || "15");
  return Number.isFinite(margin) && margin >= 0 && margin <= 100 ? margin : 15;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function sanitizeProviderResponse(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeProviderResponse);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          ![
            "secretKey",
            "transactionId",
            "paymentIntent",
            "clientSecret",
            "offerRetailRate",
            "offerInitialPrice",
            "providerSuggestedSellingPrice",
            "commission",
            "providerCommission",
            "price",
            "priceDifferencePercent",
            "marginPercent",
            "supplier",
            "supplierId",
          ].includes(key),
      )
      .map(([key, nestedValue]) => [key, sanitizeProviderResponse(nestedValue)]),
  );
}

function normalizeRatesResult(result) {
  if (!Array.isArray(result?.data)) {
    return result;
  }

  const marginPercent = getMargin();

  const normalized = {
    ...result,
    data: result.data.map((hotel) => ({
      ...hotel,
      roomTypes: Array.isArray(hotel?.roomTypes)
        ? hotel.roomTypes.map((room) => {
            const basePrice = Number(room?.offerRetailRate?.amount);
            if (!Number.isFinite(basePrice) || basePrice < 0) {
              return room;
            }

            const sellingPrice = roundMoney(
              basePrice * (1 + marginPercent / 100),
            );

            return {
              ...room,
              suggestedSellingPrice: {
                ...(room.suggestedSellingPrice || {}),
                amount: sellingPrice,
                currency:
                  room?.offerRetailRate?.currency ||
                  room?.suggestedSellingPrice?.currency ||
                  "",
              },
            };
          })
        : hotel?.roomTypes,
    })),
  };

  return sanitizeProviderResponse(normalized);
}

function normalizePrebookResult(result) {
  const basePrice = Number(result?.data?.price);
  const sanitized = sanitizeProviderResponse(result);
  const data = sanitized?.data;

  if (
    !data ||
    typeof data !== "object" ||
    !Number.isFinite(basePrice) ||
    basePrice < 0
  ) {
    return sanitized;
  }

  const sellingPrice = roundMoney(basePrice * (1 + getMargin() / 100));

  return {
    ...sanitized,
    data: {
      ...data,
      suggestedSellingPrice: sellingPrice,
      sellingPriceToUser: sellingPrice,
    },
  };
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

hotelsRouter.get("/status", (request, response) => {
  response.json(getNuiteeStatus());
});

hotelsRouter.get("/", searchLimiter, async (request, response, next) => {
  try {
    const countryCode = isoCode(request.query.countryCode, "countryCode", 2);
    const cityName = requiredText(request.query.cityName, "cityName", 100);

    const result = await listNuiteeHotels({
      countryCode,
      cityName,
      hotelName: optionalText(request.query.hotelName, 100),
      limit: boundedInteger(request.query.limit, 100, 1, 200),
      offset: boundedInteger(request.query.offset, 0, 0, 5000),
    });

    response.set("Cache-Control", "public, max-age=900");
    response.json(result);
  } catch (error) {
    next(error);
  }
});

hotelsRouter.get(
  "/translations/:hotelId",
  translationLimiter,
  async (request, response, next) => {
    try {
      const hotelId = requiredText(request.params.hotelId, "hotelId", 100);
      if (!/^[A-Za-z0-9_-]+$/.test(hotelId)) {
        throw requestError("hotelId contains invalid characters.");
      }

      const language = optionalText(request.query.language || "en", 5).toLowerCase();
      if (!["en", "tr", "ru", "ar", "zh", "es", "pt", "fr", "de", "it"].includes(language)) {
        throw requestError("language is not supported.");
      }

      const result = await getLocalizedHotelDescription(hotelId, language);
      response.set("Cache-Control", "private, max-age=3600");
      response.json(result);
    } catch (error) {
      next(error);
    }
  },
);

hotelsRouter.get("/:hotelId", searchLimiter, async (request, response, next) => {
  try {
    const hotelId = requiredText(request.params.hotelId, "hotelId", 100);

    if (!/^[A-Za-z0-9_-]+$/.test(hotelId)) {
      throw requestError("hotelId contains invalid characters.");
    }

    const result = await getNuiteeHotel(hotelId);
    response.set("Cache-Control", "public, max-age=3600");
    response.json(sanitizeProviderResponse(result));
  } catch (error) {
    next(error);
  }
});

hotelsRouter.post("/rates", searchLimiter, async (request, response, next) => {
  try {
    const checkin = isoDate(request.body?.checkin, "checkin");
    const checkout = isoDate(request.body?.checkout, "checkout");

    if (checkout <= checkin) {
      throw requestError("checkout must be after checkin.");
    }

    const hotelIds = Array.isArray(request.body?.hotelIds)
      ? request.body.hotelIds
          .map((id) => String(id || "").trim())
          .filter(Boolean)
          .slice(0, 200)
      : [];

    const location = hotelIds.length
      ? { hotelIds }
      : {
          countryCode: isoCode(request.body?.countryCode, "countryCode", 2),
          cityName: requiredText(request.body?.cityName, "cityName", 100),
        };

    const result = await searchNuiteeRates({
      ...location,
      checkin,
      checkout,
      currency: isoCode(request.body?.currency || "USD", "currency", 3),
      guestNationality: isoCode(
        request.body?.guestNationality || "TR",
        "guestNationality",
        2,
      ),
      occupancies: normalizeOccupancies(request.body?.occupancies),
      margin: getMargin(),
      includeHotelData: true,
      roomMapping: true,
      maxRatesPerHotel: boundedInteger(request.body?.maxRatesPerHotel, 3, 1, 10),
      limit: boundedInteger(request.body?.limit, 100, 1, 200),
      timeout: boundedInteger(request.body?.timeout, 8, 4, 12),
      sessionId: optionalText(request.body?.sessionId, 100) || undefined,
      refundableRatesOnly:
        request.body?.refundableRatesOnly === true ? true : undefined,
    });

    response.set("Cache-Control", "no-store");
    response.json(normalizeRatesResult(result));
  } catch (error) {
    next(error);
  }
});

hotelsRouter.post("/prebook", bookingLimiter, async (request, response, next) => {
  try {
    const result = await prebookNuiteeRate({
      offerId: requiredText(request.body?.offerId, "offerId", 5000),
      usePaymentSdk: false,
    });

    response.set("Cache-Control", "no-store");
    response.json(normalizePrebookResult(result));
  } catch (error) {
    next(error);
  }
});

hotelsRouter.post("/book-sandbox", bookingLimiter, async (request, response, next) => {
  try {
    const guests = Array.isArray(request.body?.guests)
      ? request.body.guests.map((guest, index) =>
          normalizePerson(guest, `guests[${index}]`, true),
        )
      : [];

    if (!guests.length || guests.length > 20) {
      throw requestError("guests must contain between 1 and 20 entries.");
    }

    const result = await bookNuiteeSandbox({
      prebookId: requiredText(request.body?.prebookId, "prebookId", 500),
      clientReference: requiredText(
        request.body?.clientReference,
        "clientReference",
        100,
      ),
      holder: normalizePerson(request.body?.holder, "holder"),
      guests,
      customTags: { CHANNEL: "ROTAVOY_SANDBOX" },
    });

    response.set("Cache-Control", "no-store");
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
});
