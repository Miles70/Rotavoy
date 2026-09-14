const ROTAVOY_PRODUCT_LANGUAGES = ["en", "tr", "ru", "ar", "zh", "es", "pt", "fr", "de", "it"];

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
