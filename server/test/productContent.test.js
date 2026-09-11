import assert from "node:assert/strict";
import test from "node:test";
import {
  appendVariantToProductTitle,
  normalizeContentBundle,
  PRODUCT_CONTENT_VERSION,
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
