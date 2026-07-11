import { Product } from "../models/Product.js";
import {
  applyCachedCatalogTranslation,
  normalizeCatalogLanguage,
} from "./catalogTranslation.js";

const SUMMARY_SEPARATOR = "___KR_SUMMARY_SEPARATOR___";
const summaryTranslationJobs = new Map();

const PROVIDER_NAMES = {
  mymemory: "mymemory",
  libretranslate: "libretranslate",
  deepl: "deepl",
};

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getTranslationProvider() {
  const configured = String(
    process.env.TRANSLATION_PROVIDER || "mymemory"
  )
    .trim()
    .toLowerCase();

  return PROVIDER_NAMES[configured] || PROVIDER_NAMES.mymemory;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.TRANSLATION_TIMEOUT_MS || 15000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        payload.message ||
        payload.error ||
        `Translation request failed (${response.status}).`;
      throw new Error(message);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateWithMyMemory(text, targetLanguage) {
  const endpoint =
    process.env.TRANSLATION_API_URL ||
    "https://api.mymemory.translated.net/get";
  const query = new URLSearchParams({
    q: text,
    langpair: `en|${targetLanguage}`,
  });

  const email = String(process.env.TRANSLATION_EMAIL || "").trim();
  if (email) query.set("de", email);

  const payload = await fetchJson(`${endpoint}?${query.toString()}`);
  const translatedText = payload?.responseData?.translatedText;

  if (!translatedText) {
    throw new Error("MyMemory returned an empty summary translation.");
  }

  return decodeHtmlEntities(translatedText);
}

async function translateWithLibreTranslate(text, targetLanguage) {
  const endpoint =
    process.env.TRANSLATION_API_URL ||
    "https://libretranslate.com/translate";
  const payload = await fetchJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: "en",
      target: targetLanguage,
      format: "text",
      api_key: process.env.TRANSLATION_API_KEY || undefined,
    }),
  });

  if (!payload.translatedText) {
    throw new Error("LibreTranslate returned an empty summary translation.");
  }

  return normalizeText(payload.translatedText);
}

async function translateWithDeepL(text, targetLanguage) {
  const apiKey = String(process.env.TRANSLATION_API_KEY || "").trim();
  if (!apiKey) throw new Error("TRANSLATION_API_KEY is required for DeepL.");

  const endpoint =
    process.env.TRANSLATION_API_URL ||
    "https://api-free.deepl.com/v2/translate";
  const deeplTargets = { tr: "TR", ru: "RU", ar: "AR", zh: "ZH-HANS" };

  const payload = await fetchJson(endpoint, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: [text],
      source_lang: "EN",
      target_lang:
        deeplTargets[targetLanguage] || targetLanguage.toUpperCase(),
    }),
  });

  const translatedText = payload?.translations?.[0]?.text;
  if (!translatedText) {
    throw new Error("DeepL returned an empty summary translation.");
  }

  return normalizeText(translatedText);
}

async function translateRawText(text, targetLanguage) {
  const provider = getTranslationProvider();

  if (provider === PROVIDER_NAMES.libretranslate) {
    return translateWithLibreTranslate(text, targetLanguage);
  }

  if (provider === PROVIDER_NAMES.deepl) {
    return translateWithDeepL(text, targetLanguage);
  }

  return translateWithMyMemory(text, targetLanguage);
}

function splitLongText(value, maximumLength = 440) {
  const text = normalizeText(value);
  if (!text) return [];
  if (text.length <= maximumLength) return [text];

  const chunks = [];
  const words = text.split(/\s+/);
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length > maximumLength && current) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function translateSingleText(value, targetLanguage) {
  const chunks = splitLongText(value);
  if (chunks.length === 0) return "";

  const translatedChunks = [];
  for (const chunk of chunks) {
    translatedChunks.push(await translateRawText(chunk, targetLanguage));
  }

  return translatedChunks.join(" ").trim();
}

async function mapWithConcurrency(values, worker, concurrency = 3) {
  const results = new Array(values.length);
  let cursor = 0;

  async function run() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => run())
  );

  return results;
}

function createTranslationGroups(values, maximumLength = 430) {
  const groups = [];
  let current = [];
  let currentLength = 0;
  const separatorLength = SUMMARY_SEPARATOR.length + 2;

  for (const value of values) {
    const normalized = normalizeText(value);
    const candidateLength =
      currentLength + normalized.length + (current.length ? separatorLength : 0);

    if (current.length > 0 && candidateLength > maximumLength) {
      groups.push(current);
      current = [normalized];
      currentLength = normalized.length;
    } else {
      current.push(normalized);
      currentLength = candidateLength;
    }
  }

  if (current.length > 0) groups.push(current);
  return groups;
}

async function translateTextGroup(group, targetLanguage) {
  if (group.length === 1) {
    return [await translateSingleText(group[0], targetLanguage)];
  }

  const joined = group.join(`\n${SUMMARY_SEPARATOR}\n`);

  try {
    const translated = await translateSingleText(joined, targetLanguage);
    const parts = translated
      .split(SUMMARY_SEPARATOR)
      .map((part) => normalizeText(part));

    if (parts.length === group.length && parts.every(Boolean)) {
      return parts;
    }
  } catch (error) {
    console.warn(
      `[catalog-summary-translation] batch -> ${targetLanguage} failed: ${error.message}`
    );
  }

  return mapWithConcurrency(
    group,
    async (value) => {
      try {
        return await translateSingleText(value, targetLanguage);
      } catch (error) {
        console.warn(
          `[catalog-summary-translation] text -> ${targetLanguage} failed: ${error.message}`
        );
        return value;
      }
    },
    2
  );
}

async function translateUniqueTexts(values, targetLanguage) {
  const uniqueValues = [...new Set(values.map(normalizeText).filter(Boolean))];
  const groups = createTranslationGroups(uniqueValues);
  const translatedGroups = await mapWithConcurrency(
    groups,
    (group) => translateTextGroup(group, targetLanguage),
    3
  );
  const translatedValues = translatedGroups.flat();

  return new Map(
    uniqueValues.map((value, index) => [
      value,
      translatedValues[index] || value,
    ])
  );
}

function applySummaryTranslation(product, language) {
  const fullTranslation = product.translations?.[language];
  if (fullTranslation?.title) {
    return applyCachedCatalogTranslation(product, language);
  }

  const summaryTranslation = product.summaryTranslations?.[language];
  if (!summaryTranslation?.title) return product;

  return {
    ...product,
    title: summaryTranslation.title || product.title,
    categoryLabel:
      summaryTranslation.categoryLabel || product.categoryLabel,
    translationLanguage: language,
  };
}

export async function localizeCatalogProductSummaries(
  products,
  requestedLanguage
) {
  const language = normalizeCatalogLanguage(requestedLanguage);
  if (language === "en" || products.length === 0) return products;

  const missingProducts = products.filter((product) => {
    const fullTranslation = product.translations?.[language];
    const summaryTranslation = product.summaryTranslations?.[language];
    return !fullTranslation?.title && !summaryTranslation?.title;
  });

  if (missingProducts.length === 0) {
    return products.map((product) => applySummaryTranslation(product, language));
  }

  const jobKey = `${language}:${missingProducts
    .map((product) => product.key)
    .sort()
    .join(",")}`;

  let job = summaryTranslationJobs.get(jobKey);

  if (!job) {
    job = (async () => {
      try {
        const texts = missingProducts.flatMap((product) => [
          product.title,
          product.categoryLabel,
        ]);
        const translatedTexts = await translateUniqueTexts(texts, language);
        const provider = getTranslationProvider();
        const translatedAt = new Date().toISOString();
        const summaries = new Map();

        const operations = missingProducts.map((product) => {
          const summary = {
            title:
              translatedTexts.get(normalizeText(product.title)) || product.title,
            categoryLabel:
              translatedTexts.get(normalizeText(product.categoryLabel)) ||
              product.categoryLabel,
            provider,
            translatedAt,
          };

          summaries.set(product.key, summary);

          return {
            updateOne: {
              filter: { _id: product._id },
              update: {
                $set: {
                  [`summaryTranslations.${language}`]: summary,
                },
              },
            },
          };
        });

        if (operations.length > 0) {
          await Product.bulkWrite(operations, { ordered: false });
        }

        return summaries;
      } catch (error) {
        console.warn(
          `[catalog-summary-translation] ${language} failed: ${error.message}`
        );
        return new Map();
      } finally {
        summaryTranslationJobs.delete(jobKey);
      }
    })();

    summaryTranslationJobs.set(jobKey, job);
  }

  const createdSummaries = await job;

  return products.map((product) => {
    const createdSummary = createdSummaries.get(product.key);

    if (createdSummary) {
      return {
        ...product,
        title: createdSummary.title || product.title,
        categoryLabel: createdSummary.categoryLabel || product.categoryLabel,
        translationLanguage: language,
      };
    }

    return applySummaryTranslation(product, language);
  });
}
