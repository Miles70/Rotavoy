import { Product } from "../models/Product.js";
import { getRotavoyProductLanguages } from "./productTranslation.js";

export const PRODUCT_CONTENT_VERSION = "rotavoy-ai-copy-v1";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.6-luna";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_REQUEST_INTERVAL_MS = 750;
const DEFAULT_BATCH_SIZE = 20;

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

let contentQueue = Promise.resolve();
let lastContentRequestAt = 0;

function parsePositiveInt(value, fallback, max = 10_000) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function cleanText(value, maxLength = 2_000) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function uniqueStrings(values, maxItems = 6, maxLength = 120) {
  const seen = new Set();
  const output = [];

  for (const value of Array.isArray(values) ? values : []) {
    const clean = cleanText(value, maxLength);
    const key = clean.toLocaleLowerCase("en-US");
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
    if (output.length >= maxItems) break;
  }

  return output;
}

export function appendVariantToProductTitle(title, variantLabel) {
  const cleanTitle = cleanText(title, 180);
  const cleanVariant = cleanText(variantLabel, 100);
  if (!cleanVariant || cleanVariant.toLowerCase() === "default") return cleanTitle;
  if (cleanTitle.toLowerCase().includes(cleanVariant.toLowerCase())) return cleanTitle;
  return `${cleanTitle} - ${cleanVariant}`.slice(0, 220);
}

export function isProductContentAiConfigured() {
  const enabled = String(process.env.ROTAVOY_AI_CONTENT_ENABLED || "true").toLowerCase() !== "false";
  return enabled && Boolean(String(process.env.OPENAI_API_KEY || "").trim());
}

function getModel() {
  return String(process.env.ROTAVOY_CONTENT_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function getResponseSchema() {
  const localizedEntry = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 2, maxLength: 140 },
      description: { type: "string", minLength: 20, maxLength: 900 },
      features: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        items: { type: "string", minLength: 2, maxLength: 120 },
      },
      categoryLabel: { type: "string", minLength: 2, maxLength: 220 },
      variants: {
        type: "array",
        minItems: 1,
        maxItems: 12,
        items: { type: "string", minLength: 1, maxLength: 120 },
      },
    },
    required: ["title", "description", "features", "categoryLabel", "variants"],
  };

  const languages = getRotavoyProductLanguages();
  const translationProperties = Object.fromEntries(
    languages.map((language) => [language, localizedEntry]),
  );

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      translations: {
        type: "object",
        additionalProperties: false,
        properties: translationProperties,
        required: languages,
      },
    },
    required: ["translations"],
  };
}

function buildInstructions() {
  const languageList = getRotavoyProductLanguages()
    .map((language) => `${language}=${LANGUAGE_NAMES[language] || language}`)
    .join(", ");

  return [
    "You are Rotavoy's ecommerce catalog editor.",
    "Rewrite low-quality supplier copy into concise, professional marketplace copy and localize it natively.",
    "Use ONLY facts explicitly present in the supplied title, description, category path, variant names and attributes.",
    "Never invent materials, certifications, dimensions, compatibility, waterproofing, performance claims, use cases or benefits that are not supported by the source.",
    "Remove empty supplier fluff such as 'good material', 'unique design', 'stylish and beautiful', repeated words and awkward keyword stuffing.",
    "Keep model numbers, brand names, sizes and technical identifiers exact when they matter.",
    "The base title must NOT include a variant value; Rotavoy appends the localized variant separately.",
    "Descriptions should read like a professional retailer wrote them, not like a literal machine translation. Prefer 1-3 compact sentences.",
    "Features must be short factual bullets directly supported by source data. Do not add a feature merely because it is common for that product type.",
    "Translate category hierarchy naturally while preserving its levels and > separators.",
    "Variant arrays must preserve the exact input order and item count in every language.",
    `Return native professional copy for exactly these languages: ${languageList}.`,
    "Do not include markdown, commentary, disclaimers or fields outside the requested JSON schema.",
  ].join(" ");
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("").trim();
}

function enqueueContentRequest(task) {
  const intervalMs = parsePositiveInt(
    process.env.ROTAVOY_CONTENT_REQUEST_INTERVAL_MS,
    DEFAULT_REQUEST_INTERVAL_MS,
    30_000,
  );

  const run = contentQueue.then(async () => {
    const waitMs = Math.max(intervalMs - (Date.now() - lastContentRequestAt), 0);
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));

    try {
      return await task();
    } finally {
      lastContentRequestAt = Date.now();
    }
  });

  contentQueue = run.catch(() => undefined);
  return run;
}

export function normalizeContentBundle(bundle, expectedVariantCount) {
  const languages = getRotavoyProductLanguages();
  const translations = bundle?.translations;
  if (!translations || typeof translations !== "object") {
    throw new Error("AI product content is missing translations.");
  }

  const normalized = {};
  for (const language of languages) {
    const entry = translations[language];
    if (!entry || typeof entry !== "object") {
      throw new Error(`AI product content is missing ${language}.`);
    }

    const variants = (Array.isArray(entry.variants) ? entry.variants : []).map((value) => cleanText(value, 120));
    if (variants.length !== expectedVariantCount || variants.some((value) => !value)) {
      throw new Error(`AI product content returned an invalid ${language} variant list.`);
    }

    const title = cleanText(entry.title, 140);
    const description = cleanText(entry.description, 900);
    const categoryLabel = cleanText(entry.categoryLabel, 220);
    const features = uniqueStrings(entry.features, 6, 120);

    if (!title || !description || !categoryLabel || features.length < 2) {
      throw new Error(`AI product content returned incomplete ${language} copy.`);
    }

    normalized[language] = {
      title,
      description,
      categoryLabel,
      features,
      variants,
    };
  }

  return normalized;
}

async function requestProfessionalContent(source) {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for professional product content enrichment.");
  }

  const timeoutMs = parsePositiveInt(
    process.env.ROTAVOY_CONTENT_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    180_000,
  );
  const model = getModel();

  return enqueueContentRequest(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          instructions: buildInstructions(),
          input: JSON.stringify(source),
          store: false,
          text: {
            format: {
              type: "json_schema",
              name: "rotavoy_product_content",
              strict: true,
              schema: getResponseSchema(),
            },
          },
          max_output_tokens: 12_000,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          cleanText(payload?.error?.message || payload?.message || `OpenAI content request failed with ${response.status}.`, 500),
        );
      }
      if (payload?.status && payload.status !== "completed") {
        throw new Error(`OpenAI product content response ended with status ${payload.status}.`);
      }

      const text = extractResponseText(payload);
      if (!text) throw new Error("OpenAI returned no product content.");

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("OpenAI returned product content that was not valid JSON.");
      }

      return {
        translations: normalizeContentBundle(parsed, source.variants.length),
        model,
        usage: payload?.usage || {},
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("OpenAI product content request timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  });
}

function getSupplierContent(product) {
  const raw = product?.supplierContent && typeof product.supplierContent === "object"
    ? product.supplierContent
    : {};

  return {
    title: cleanText(raw.title || product?.title, 300),
    description: cleanText(raw.description || product?.description, 2_000),
    categoryLabel: cleanText(raw.categoryLabel || product?.categoryLabel || "General", 220),
    variant: cleanText(raw.variant || product?.details?.variant || product?.supplierSku || "Default", 120),
  };
}

function buildVariantTranslations(bundle, variantIndex) {
  const translations = {};

  for (const [language, entry] of Object.entries(bundle)) {
    const variant = entry.variants[variantIndex] || "Default";
    translations[language] = {
      title: appendVariantToProductTitle(entry.title, variant),
      description: entry.description,
      categoryLabel: entry.categoryLabel,
      variant,
      features: entry.features,
    };
  }

  return translations;
}

async function enrichSupplierProduct(supplierProductId) {
  const products = await Product.find({
    source: "cj",
    supplierProductId,
    isActive: true,
  })
    .sort({ supplierVariantId: 1, key: 1 })
    .lean();

  if (!products.length) return { status: "skipped", supplierProductId };

  const rawEntries = products.map(getSupplierContent);
  const sourceHash = String(products[0].sourceHash || "").trim();
  const source = {
    supplier: "CJdropshipping",
    supplierProductId,
    title: rawEntries[0].title,
    description: rawEntries[0].description,
    categoryLabel: rawEntries[0].categoryLabel,
    variants: rawEntries.map((entry) => entry.variant),
  };

  if (!source.title || !source.description || !source.categoryLabel || source.variants.some((value) => !value)) {
    throw new Error(`CJ source content is incomplete for ${supplierProductId}.`);
  }

  const generated = await requestProfessionalContent(source);
  const now = new Date();
  const english = generated.translations.en;
  const operations = products.map((product, index) => {
    const translations = buildVariantTranslations(generated.translations, index);
    const englishVariant = translations.en;

    return {
      updateOne: {
        filter: {
          _id: product._id,
          sourceHash,
        },
        update: {
          $set: {
            title: englishVariant.title,
            description: english.description,
            features: english.features,
            categoryLabel: english.categoryLabel,
            translations,
            translationMeta: {
              provider: "openai",
              model: generated.model,
              sourceHash,
              sourceLanguage: "en",
              languages: Object.keys(translations),
              contentVersion: PRODUCT_CONTENT_VERSION,
              updatedAt: now,
            },
            contentMeta: {
              status: "ready",
              provider: "openai",
              model: generated.model,
              version: PRODUCT_CONTENT_VERSION,
              sourceHash,
              updatedAt: now,
              error: "",
            },
          },
        },
      },
    };
  });

  const result = await Product.bulkWrite(operations, { ordered: false });
  const matched = Number(result.matchedCount || 0);
  if (matched !== products.length) {
    throw new Error(`CJ source changed while enriching ${supplierProductId}; content was not applied to every variant.`);
  }

  return {
    status: "ready",
    supplierProductId,
    variants: products.length,
    model: generated.model,
    usage: generated.usage,
  };
}

async function markSupplierProductFailed(supplierProductId, error) {
  await Product.updateMany(
    { source: "cj", supplierProductId, isActive: true },
    {
      $set: {
        contentMeta: {
          status: "failed",
          provider: "openai",
          model: getModel(),
          version: PRODUCT_CONTENT_VERSION,
          sourceHash: "",
          updatedAt: new Date(),
          error: cleanText(error?.message || "Product content enrichment failed.", 800),
        },
      },
    },
  );
}

async function getPendingSupplierProductIds(limit) {
  const rows = await Product.aggregate([
    {
      $match: {
        source: "cj",
        isActive: true,
        supplierProductId: { $type: "string", $ne: "" },
        $or: [
          { "contentMeta.status": { $ne: "ready" } },
          { "contentMeta.version": { $ne: PRODUCT_CONTENT_VERSION } },
        ],
      },
    },
    { $group: { _id: "$supplierProductId" } },
    { $sort: { _id: 1 } },
    { $limit: limit },
  ]);

  return rows.map((row) => String(row._id || "").trim()).filter(Boolean);
}

export async function enrichPendingProductContent({ limit } = {}) {
  if (!isProductContentAiConfigured()) {
    throw new Error("AI product content is not configured. Set OPENAI_API_KEY on the backend (or disable ROTAVOY_AI_CONTENT_ENABLED).");
  }

  const safeLimit = parsePositiveInt(
    limit ?? process.env.ROTAVOY_CONTENT_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
    500,
  );
  const supplierProductIds = await getPendingSupplierProductIds(safeLimit);
  const results = [];

  for (const supplierProductId of supplierProductIds) {
    try {
      const result = await enrichSupplierProduct(supplierProductId);
      results.push(result);
    } catch (error) {
      await markSupplierProductFailed(supplierProductId, error).catch(() => undefined);
      results.push({
        status: "failed",
        supplierProductId,
        error: cleanText(error?.message || "Product content enrichment failed.", 800),
      });
    }
  }

  return {
    version: PRODUCT_CONTENT_VERSION,
    model: getModel(),
    requested: supplierProductIds.length,
    succeeded: results.filter((result) => result.status === "ready").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    results,
  };
}
