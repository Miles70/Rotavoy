const SUPPORTED_LANGUAGES = new Set(["en", "tr", "ru", "ar", "zh"]);
const translationJobs = new Map();

const PROVIDER_NAMES = {
  mymemory: "mymemory",
  libretranslate: "libretranslate",
  deepl: "deepl",
};

export function normalizeCatalogLanguage(value) {
  const normalized = String(value || "en").trim().toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : "en";
}

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

function splitLongText(value, maximumLength = 450) {
  const text = normalizeText(value);
  if (!text) return [];
  if (text.length <= maximumLength) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = "";

  function pushCurrent() {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  }

  for (const sentence of sentences) {
    if (sentence.length > maximumLength) {
      pushCurrent();
      const words = sentence.split(/\s+/);
      let wordChunk = "";

      for (const word of words) {
        const candidate = wordChunk ? `${wordChunk} ${word}` : word;
        if (candidate.length > maximumLength && wordChunk) {
          chunks.push(wordChunk);
          wordChunk = word;
        } else {
          wordChunk = candidate;
        }
      }

      if (wordChunk) chunks.push(wordChunk);
      continue;
    }

    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > maximumLength) {
      pushCurrent();
      current = sentence;
    } else {
      current = candidate;
    }
  }

  pushCurrent();
  return chunks;
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
    throw new Error("MyMemory returned an empty translation.");
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
    throw new Error("LibreTranslate returned an empty translation.");
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
  if (!translatedText) throw new Error("DeepL returned an empty translation.");
  return normalizeText(translatedText);
}

function getTranslationProvider() {
  const configured = String(
    process.env.TRANSLATION_PROVIDER || "mymemory"
  )
    .trim()
    .toLowerCase();
  return PROVIDER_NAMES[configured] || PROVIDER_NAMES.mymemory;
}

async function translateChunk(text, targetLanguage) {
  const provider = getTranslationProvider();

  if (provider === PROVIDER_NAMES.libretranslate) {
    return translateWithLibreTranslate(text, targetLanguage);
  }

  if (provider === PROVIDER_NAMES.deepl) {
    return translateWithDeepL(text, targetLanguage);
  }

  return translateWithMyMemory(text, targetLanguage);
}

async function translateText(value, targetLanguage) {
  const text = normalizeText(value);
  if (!text || targetLanguage === "en") return text;

  const chunks = splitLongText(text);
  const translatedChunks = [];

  for (const chunk of chunks) {
    translatedChunks.push(await translateChunk(chunk, targetLanguage));
  }

  return translatedChunks.join(" ").trim();
}

async function mapWithConcurrency(values, worker, concurrency = 2) {
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

function mergeTranslation(product, translation, language) {
  return {
    ...product,
    title: translation.title || product.title,
    description: translation.description || product.description,
    categoryLabel: translation.categoryLabel || product.categoryLabel,
    features: Array.isArray(translation.features)
      ? translation.features
      : product.features,
    details:
      translation.details && typeof translation.details === "object"
        ? translation.details
        : product.details,
    translationLanguage: language,
  };
}

async function createTranslation(product, targetLanguage) {
  const sourceFeatures = Array.isArray(product.features)
    ? product.features.filter(Boolean).slice(0, 8)
    : [];
  const sourceDetails =
    product.details && typeof product.details === "object"
      ? Object.entries(product.details).slice(0, 10)
      : [];

  const [title, description, categoryLabel, features, detailLabels] =
    await Promise.all([
      translateText(product.title, targetLanguage),
      translateText(product.description, targetLanguage),
      translateText(product.categoryLabel, targetLanguage),
      mapWithConcurrency(
        sourceFeatures,
        (feature) => translateText(feature, targetLanguage),
        2
      ),
      mapWithConcurrency(
        sourceDetails,
        ([label]) => translateText(label, targetLanguage),
        2
      ),
    ]);

  return {
    title,
    description,
    categoryLabel,
    features,
    details: Object.fromEntries(
      sourceDetails.map(([, value], index) => [detailLabels[index], value])
    ),
    provider: getTranslationProvider(),
    translatedAt: new Date().toISOString(),
  };
}

export async function localizeCatalogProduct(
  productDocument,
  requestedLanguage
) {
  const language = normalizeCatalogLanguage(requestedLanguage);
  const plainProduct =
    typeof productDocument.toObject === "function"
      ? productDocument.toObject()
      : productDocument;

  if (language === "en") return plainProduct;

  const cachedTranslation = plainProduct.translations?.[language];
  if (cachedTranslation?.title) {
    return mergeTranslation(plainProduct, cachedTranslation, language);
  }

  const jobKey = `${plainProduct._id || plainProduct.key}:${language}`;
  if (translationJobs.has(jobKey)) return translationJobs.get(jobKey);

  const job = (async () => {
    try {
      const translation = await createTranslation(plainProduct, language);

      if (typeof productDocument.save === "function") {
        productDocument.translations = {
          ...(productDocument.translations || {}),
          [language]: translation,
        };
        productDocument.markModified("translations");
        await productDocument.save();
      }

      return mergeTranslation(plainProduct, translation, language);
    } catch (error) {
      console.warn(
        `[catalog-translation] ${plainProduct.key} -> ${language} failed: ${error.message}`
      );
      return plainProduct;
    } finally {
      translationJobs.delete(jobKey);
    }
  })();

  translationJobs.set(jobKey, job);
  return job;
}

export function applyCachedCatalogTranslation(product, requestedLanguage) {
  const language = normalizeCatalogLanguage(requestedLanguage);
  if (language === "en") return product;

  const translation = product.translations?.[language];
  return translation?.title
    ? mergeTranslation(product, translation, language)
    : product;
}
