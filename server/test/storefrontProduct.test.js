import assert from "node:assert/strict";
import test from "node:test";
import {
  getLocalizedSearchFields,
  normalizeStorefrontLanguage,
  trimStorefrontTranslations,
} from "../src/services/storefrontProduct.js";

test("storefront language is constrained to Rotavoy languages", () => {
  assert.equal(normalizeStorefrontLanguage("TR"), "tr");
  assert.equal(normalizeStorefrontLanguage("de"), "de");
  assert.equal(normalizeStorefrontLanguage("xx"), "en");
});

test("localized search targets only the active translation branch", () => {
  const fields = getLocalizedSearchFields("tr");
  assert.ok(fields.includes("translations.tr.title"));
  assert.ok(fields.includes("translations.tr.features"));
  assert.equal(fields.some((field) => field.includes("translations.de")), false);
});

test("storefront payload keeps requested translation and English fallback only", () => {
  const product = {
    key: "cj-1",
    translations: {
      en: { title: "Gloves" },
      tr: { title: "Eldiven" },
      de: { title: "Handschuhe" },
    },
  };

  const trimmed = trimStorefrontTranslations(product, "tr");
  assert.deepEqual(Object.keys(trimmed.translations).sort(), ["en", "tr"]);
  assert.equal(trimmed.translations.tr.title, "Eldiven");
  assert.equal(trimmed.translations.de, undefined);
});
