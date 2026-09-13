const ROTAVOY_PRODUCT_LANGUAGES = ["en", "tr", "ru", "ar", "zh", "es", "pt", "fr", "de", "it"];
const GOOGLE_LANGUAGE_CODES = {
  tr: "tr",
  ru: "ru",
  ar: "ar",
  zh: "zh-CN",
  es: "es",
  pt: "pt",
  fr: "fr",
  de: "de",
  it: "it",
};

const TRANSLATION_SEPARATOR = "[[[ROTAVOY_SPLIT_7E4F]]]";
const DEFAULT_TRANSLATION_INTERVAL_MS = 280;
const DEFAULT_TRANSLATION_TIMEOUT_MS = 15_000;

let translationQueue = Promise.resolve();
let lastTranslationAt = 0;

function parsePositiveInt(value, fallback, max = 10_000) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function isTranslationEnabled() {
  return String(process.env.CJ_TRANSLATE_PRODUCTS || "true").toLowerCase() !== "false";
}

function enqueueTranslation(task) {
  const intervalMs = parsePositiveInt(
    process.env.PRODUCT_TRANSLATION_REQUEST_INTERVAL_MS,
    DEFAULT_TRANSLATION_INTERVAL_MS,
    5_000,
  );

  const run = translationQueue.then(async () => {
    const waitMs = Math.max(intervalMs - (Date.now() - lastTranslationAt), 0);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    try {
      return await task();
    } finally {
      lastTranslationAt = Date.now();
    }
  });

  translationQueue = run.catch(() => undefined);
  return run;
}

function extractGoogleTranslation(payload) {
  if (!Array.isArray(payload?.[0])) return "";
  return payload[0]
    .map((segment) => String(segment?.[0] || ""))
    .join("")
    .trim();
}

async function requestGoogleTranslation(text, language) {
  if (!text) return "";

  const targetLanguage = GOOGLE_LANGUAGE_CODES[language] || language;
  const timeoutMs = parsePositiveInt(
    process.env.PRODUCT_TRANSLATION_TIMEOUT_MS,
    DEFAULT_TRANSLATION_TIMEOUT_MS,
    60_000,
  );

  return enqueueTranslation(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = new URL("https://translate.googleapis.com/translate_a/single");
      url.searchParams.set("client", "gtx");
      url.searchParams.set("sl", "en");
      url.searchParams.set("tl", targetLanguage);
      url.searchParams.set("dt", "t");
      url.searchParams.set("q", text);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent": "Rotavoy-Catalog-Translator/1.0",
        },
      });

      if (!response.ok) {
        const error = new Error(`Translation request failed with ${response.status}.`);
        error.statusCode = response.status;
        error.retryAfter = String(response.headers.get("retry-after") || "").trim();
        throw error;
      }

      const payload = await response.json();
      const translated = extractGoogleTranslation(payload);
      if (!translated) throw new Error("Translation service returned an empty response.");
      return translated;
    } finally {
      clearTimeout(timeout);
    }
  });
}

function splitTranslatedFields(translated, expectedCount) {
  const parts = String(translated || "")
    .split(TRANSLATION_SEPARATOR)
    .map((value) => value.trim());

  return parts.length === expectedCount ? parts : null;
}

async function translateFields(fields, language) {
  const sourceFields = fields.map((value) => String(value || "").trim());
  if (sourceFields.every((value) => !value)) return sourceFields;

  const joined = sourceFields.join(`\n\n${TRANSLATION_SEPARATOR}\n\n`);
  const translated = await requestGoogleTranslation(joined, language);
  const split = splitTranslatedFields(translated, sourceFields.length);

  if (split) return split;

  const fallback = [];
  for (const field of sourceFields) {
    fallback.push(field ? await requestGoogleTranslation(field, language) : "");
  }
  return fallback;
}

export function getRotavoyProductLanguages() {
  return [...ROTAVOY_PRODUCT_LANGUAGES];
}

export function productTranslationsComplete(translations) {
  if (!translations || typeof translations !== "object") return false;

  return ROTAVOY_PRODUCT_LANGUAGES.every((language) => {
    const entry = translations[language];
    return Boolean(
      entry &&
      typeof entry === "object" &&
      String(entry.title || "").trim() &&
      Object.prototype.hasOwnProperty.call(entry, "description") &&
      String(entry.categoryLabel || "").trim() &&
      String(entry.variant || "").trim(),
    );
  });
}

export async function translateProductBundle({
  title,
  description,
  categoryLabel,
  variants,
}) {
  const normalizedVariants = (Array.isArray(variants) ? variants : []).map((value) => String(value || "").trim());
  const sourceFields = [title, description, categoryLabel, ...normalizedVariants];
  const translations = {
    en: {
      title: String(title || "").trim(),
      description: String(description || "").trim(),
      categoryLabel: String(categoryLabel || "").trim(),
      variants: normalizedVariants,
    },
  };

  if (!isTranslationEnabled()) return translations;

  for (const language of ROTAVOY_PRODUCT_LANGUAGES.filter((value) => value !== "en")) {
    try {
      const values = await translateFields(sourceFields, language);
      translations[language] = {
        title: values[0] || translations.en.title,
        description: values[1] || translations.en.description,
        categoryLabel: values[2] || translations.en.categoryLabel,
        variants: normalizedVariants.map((variant, index) => values[index + 3] || variant),
      };
    } catch (error) {
      // A 429 applies to the caller/IP, not just this language. Propagate it so
      // batch jobs stop immediately instead of hammering every remaining
      // language and product with requests that cannot succeed.
      if (Number(error?.statusCode) === 429) throw error;
      console.warn(`Product translation skipped for ${language}:`, error.message);
    }
  }

  return translations;
}
