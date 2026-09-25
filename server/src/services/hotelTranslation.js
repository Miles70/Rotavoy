import crypto from "node:crypto";
import { HotelTranslation } from "../models/HotelTranslation.js";
import { getNuiteeHotel } from "./nuiteeApi.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const LANGUAGES = ["en", "tr", "ru", "ar", "zh", "es", "pt", "fr", "de", "it"];
const LANGUAGE_NAMES = {
  en: "English",
  tr: "Turkish",
  ru: "Russian",
  ar: "Arabic",
  zh: "Simplified Chinese",
  es: "Spanish",
  pt: "Brazilian Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
};

let translationQueue = Promise.resolve();

function cleanText(value, maxLength = 8_000) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function unwrapHotel(payload) {
  return payload?.data?.hotel || payload?.data || payload?.hotel || payload || {};
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const entry of Array.isArray(item?.content) ? item.content : []) {
      if (entry?.type === "output_text" && typeof entry.text === "string") {
        parts.push(entry.text);
      }
    }
  }
  return parts.join("").trim();
}

function getSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      translations: {
        type: "object",
        additionalProperties: false,
        properties: Object.fromEntries(
          LANGUAGES.map((language) => [
            language,
            { type: "string", minLength: 20, maxLength: 5_000 },
          ]),
        ),
        required: LANGUAGES,
      },
    },
    required: ["translations"],
  };
}

function getModel() {
  return (
    String(
      process.env.ROTAVOY_HOTEL_TRANSLATION_MODEL ||
        process.env.ROTAVOY_CONTENT_MODEL ||
        "gpt-5.6-luna",
    ).trim() || "gpt-5.6-luna"
  );
}

async function generateTranslations(source) {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("Hotel translation is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const task = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: getModel(),
          store: false,
          instructions: [
            "Translate the supplied hotel description naturally and accurately.",
            "Preserve every factual statement, proper noun, distance, service and restriction.",
            "Do not invent amenities or marketing claims.",
            "Remove supplier HTML and return plain readable prose.",
            "Use fluent native travel-industry wording in each language.",
            `Return exactly these languages: ${LANGUAGES.map((code) => `${code}=${LANGUAGE_NAMES[code]}`).join(", ")}.`,
          ].join(" "),
          input: JSON.stringify({ description: source }),
          text: {
            format: {
              type: "json_schema",
              name: "rotavoy_hotel_translation",
              strict: true,
              schema: getSchema(),
            },
          },
          max_output_tokens: 12_000,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(
          cleanText(
            payload?.error?.message ||
              payload?.message ||
              `Hotel translation failed with ${response.status}.`,
            500,
          ),
        );
        error.statusCode = 502;
        throw error;
      }

      const output = extractResponseText(payload);
      const parsed = JSON.parse(output);
      const translations = parsed?.translations;

      if (
        !translations ||
        LANGUAGES.some(
          (language) => cleanText(translations[language], 5_000).length < 20,
        )
      ) {
        throw new Error("Hotel translation response was incomplete.");
      }

      return Object.fromEntries(
        LANGUAGES.map((language) => [
          language,
          cleanText(translations[language], 5_000),
        ]),
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeoutError = new Error("Hotel translation timed out.");
        timeoutError.statusCode = 504;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  const run = translationQueue.then(task);
  translationQueue = run.catch(() => undefined);
  return run;
}

export async function getLocalizedHotelDescription(hotelId, language) {
  const safeLanguage = LANGUAGES.includes(language) ? language : "en";
  const payload = await getNuiteeHotel(hotelId);
  const hotel = unwrapHotel(payload);
  const source = cleanText(hotel?.description || hotel?.hotelDescription);

  if (!source) {
    return { hotelId, language: safeLanguage, description: "", cached: true };
  }

  if (safeLanguage === "en") {
    return {
      hotelId,
      language: safeLanguage,
      description: source,
      cached: true,
    };
  }

  const sourceHash = crypto.createHash("sha256").update(source).digest("hex");
  const cached = await HotelTranslation.findOne({ hotelId, sourceHash }).lean();
  const cachedDescription = cleanText(cached?.translations?.[safeLanguage], 5_000);

  if (cachedDescription) {
    return {
      hotelId,
      language: safeLanguage,
      description: cachedDescription,
      cached: true,
    };
  }

  const translations = await generateTranslations(source);
  await HotelTranslation.findOneAndUpdate(
    { hotelId },
    {
      $set: {
        sourceHash,
        sourceLanguage: "en",
        translations,
        model: getModel(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return {
    hotelId,
    language: safeLanguage,
    description: translations[safeLanguage],
    cached: false,
  };
}
