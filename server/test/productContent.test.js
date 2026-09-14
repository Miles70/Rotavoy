import assert from "node:assert/strict";
import test from "node:test";
import {
  appendVariantToProductTitle,
  normalizeContentBundle,
  PRODUCT_CONTENT_VERSION,
  validateCriticalSourceFacts,
} from "../src/services/productContentEnrichment.js";

const languages = ["en", "tr", "ru", "ar", "zh", "es", "pt", "fr", "de", "it"];

function makeBundle(variants = ["Black-S", "Black-M"]) {
  return {
    translations: Object.fromEntries(
      languages.map((language) => [
        language,
        {
          title: `Professional ${language} title`,
          description: `Professional ${language} product description with enough detail.`,
          features: ["Touchscreen compatible", "Fleece construction"],
          categoryLabel: "Sports > Accessories",
          variants,
        },
      ]),
    ),
  };
}

test("product content pipeline exposes a stable cache version", () => {
  assert.match(PRODUCT_CONTENT_VERSION, /^rotavoy-ai-copy-v\d+$/);
});

test("localized variant is appended once to the professional product title", () => {
  assert.equal(
    appendVariantToProductTitle("Touchscreen Fleece Gloves", "Black-S"),
    "Touchscreen Fleece Gloves - Black-S",
  );
  assert.equal(
    appendVariantToProductTitle("Touchscreen Fleece Gloves - Black-S", "Black-S"),
    "Touchscreen Fleece Gloves - Black-S",
  );
});

test("AI content requires every Rotavoy language and the exact variant count", () => {
  const normalized = normalizeContentBundle(makeBundle(), 2);
  assert.equal(Object.keys(normalized).length, languages.length);
  assert.deepEqual(normalized.tr.variants, ["Black-S", "Black-M"]);

  assert.throws(
    () => normalizeContentBundle(makeBundle(["Black-S"]), 2),
    /invalid en variant list/,
  );
});

test("AI content accepts one real feature instead of forcing filler", () => {
  const bundle = makeBundle();
  for (const entry of Object.values(bundle.translations)) {
    entry.features = ["Only source-supported feature"];
  }
  const normalized = normalizeContentBundle(bundle, 2);
  assert.deepEqual(normalized.en.features, ["Only source-supported feature"]);
});

test("critical structured source values cannot silently disappear", () => {
  const translations = normalizeContentBundle(makeBundle(), 2);
  const source = {
    title: "SKMEI 1251 Digital Watch",
    structuredFacts: [{ details: { weightGrams: 79, waterResistanceMeters: 50 } }],
  };

  assert.throws(
    () => validateCriticalSourceFacts(source, translations),
    /omitted critical source values/,
  );

  translations.en.title = "SKMEI 1251 Digital Watch";
  translations.en.features.push("79 g weight", "50 m water resistance");
  assert.equal(validateCriticalSourceFacts(source, translations), true);
});
