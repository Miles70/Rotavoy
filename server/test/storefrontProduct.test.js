import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGroupedStorefrontProduct,
  getLocalizedSearchFields,
  normalizeStorefrontLanguage,
  sanitizeStorefrontProduct,
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

test("storefront sanitization removes supplier-only identifiers and cost", () => {
  const sanitized = sanitizeStorefrontProduct({
    key: "cj-1",
    title: "Watch",
    costPrice: 3,
    supplierVariantId: "vid-secret",
    supplierSku: "sku-secret",
    supplierContent: { title: "raw" },
  });

  assert.equal(sanitized.title, "Watch");
  assert.equal(sanitized.costPrice, undefined);
  assert.equal(sanitized.supplierVariantId, undefined);
  assert.equal(sanitized.supplierSku, undefined);
  assert.equal(sanitized.supplierContent, undefined);
});

test("grouped storefront product exposes parent-level variant summary", () => {
  const grouped = buildGroupedStorefrontProduct({
    product: {
      key: "cj-cheapest-vid",
      title: "SKMEI Watch - Gold",
      price: 8,
      stock: 4,
      supplierProductId: "pid-1",
      costPrice: 2,
      translations: {
        en: { title: "SKMEI Watch - Gold", variant: "Gold" },
        tr: { title: "SKMEI Saat - Altın", variant: "Altın" },
      },
    },
    variantCount: 4,
    priceMin: 8,
    priceMax: 11,
    stockTotal: 21,
  }, "tr");

  assert.equal(grouped.key, "cj-cheapest-vid");
  assert.equal(grouped.variantCount, 4);
  assert.equal(grouped.priceMin, 8);
  assert.equal(grouped.priceMax, 11);
  assert.equal(grouped.stock, 21);
  assert.equal(grouped.costPrice, undefined);
  assert.deepEqual(Object.keys(grouped.translations).sort(), ["en", "tr"]);
});
