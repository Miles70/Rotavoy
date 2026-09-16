const ROTAVOY_PRODUCT_LANGUAGES = ["en", "tr", "ru", "ar", "zh", "es", "pt", "fr", "de", "it"];

const NATIVE_SCRIPT_PATTERNS = {
  ru: /[\u0400-\u04FF]/u,
  ar: /[\u0600-\u06FF]/u,
  zh: /[\u3400-\u9FFF]/u,
};

const ENGLISH_MARKERS = new Set([
  "the",
  "and",
  "with",
  "for",
  "this",
  "that",
  "from",
  "designed",
  "features",
  "includes",
  "provides",
  "offers",
  "made",
  "ideal",
  "suitable",
]);

const TARGET_LANGUAGE_MARKERS = {
  tr: new Set(["ve", "ile", "için", "bu", "bir", "olarak", "ürün", "kullanım", "uygun", "kolay"]),
  es: new Set(["de", "para", "con", "y", "el", "la", "los", "las", "un", "una", "este", "esta"]),
  pt: new Set(["de", "para", "com", "e", "o", "a", "os", "as", "um", "uma", "este", "esta"]),
  fr: new Set(["de", "pour", "avec", "et", "le", "la", "les", "un", "une", "ce", "cette"]),
  de: new Set(["mit", "und", "für", "der", "die", "das", "ein", "eine", "dieser", "diese"]),
  it: new Set(["di", "per", "con", "e", "il", "la", "i", "le", "un", "una", "questo", "questa"]),
};

function cleanComparableText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildEntryCoreText(entry) {
  if (!entry || typeof entry !== "object") return "";
  return [
    entry.title,
    entry.description,
    entry.categoryLabel,
    ...(Array.isArray(entry.features) ? entry.features : []),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
}

function getLetterTokens(value) {
  return String(value || "").toLocaleLowerCase("en-US").match(/\p{L}+/gu) || [];
}

function countMarkers(tokens, markers) {
  if (!markers?.size) return 0;
  return tokens.reduce((count, token) => count + Number(markers.has(token)), 0);
}

function hasUsableVariantValue(entry) {
  if (String(entry?.variant || "").trim()) return true;
  return Array.isArray(entry?.variants) &&
    entry.variants.length > 0 &&
    entry.variants.every((value) => String(value || "").trim());
}

export function getRotavoyProductLanguages() {
  return [...ROTAVOY_PRODUCT_LANGUAGES];
}

export function getProductTranslationIntegrityIssues(translations) {
  const issues = [];
  if (!translations || typeof translations !== "object") {
    return ROTAVOY_PRODUCT_LANGUAGES.map((language) => `${language}:missing`);
  }

  const englishCore = cleanComparableText(buildEntryCoreText(translations.en));

  for (const language of ROTAVOY_PRODUCT_LANGUAGES) {
    const entry = translations[language];
    const structurallyComplete = Boolean(
      entry &&
      typeof entry === "object" &&
      String(entry.title || "").trim() &&
      String(entry.description || "").trim() &&
      String(entry.categoryLabel || "").trim() &&
      hasUsableVariantValue(entry),
    );

    if (!structurallyComplete) {
      issues.push(`${language}:missing`);
      continue;
    }

    if (language === "en") continue;

    const coreText = buildEntryCoreText(entry);
    const comparable = cleanComparableText(coreText);
    if (comparable.length >= 24 && englishCore.length >= 24 && comparable === englishCore) {
      issues.push(`${language}:duplicates-en`);
      continue;
    }

    const nativeScriptPattern = NATIVE_SCRIPT_PATTERNS[language];
    if (nativeScriptPattern && comparable.length >= 24 && !nativeScriptPattern.test(coreText)) {
      issues.push(`${language}:wrong-script`);
      continue;
    }

    const targetMarkers = TARGET_LANGUAGE_MARKERS[language];
    if (targetMarkers) {
      const tokens = getLetterTokens(coreText);
      if (tokens.length >= 12) {
        const englishMarkerCount = countMarkers(tokens, ENGLISH_MARKERS);
        const targetMarkerCount = countMarkers(tokens, targetMarkers);
        if (englishMarkerCount >= 4 && targetMarkerCount === 0) {
          issues.push(`${language}:looks-english`);
        }
      }
    }
  }

  return issues;
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

/**
 * Legacy catalog translator is intentionally disabled.
 *
 * CJ sync stores only the untouched English supplier copy. The professional
 * Luna enrichment pipeline owns every localized title, description, category,
 * feature and variant value so two translation systems cannot conflict.
 */
export async function translateProductBundle({
  title,
  description,
  categoryLabel,
  variants,
}) {
  return {
    en: {
      title: String(title || "").trim(),
      description: String(description || "").trim(),
      categoryLabel: String(categoryLabel || "").trim(),
      variants: (Array.isArray(variants) ? variants : [])
        .map((value) => String(value || "").trim()),
    },
  };
}
