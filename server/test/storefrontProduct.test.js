import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalogGroupSummaries,
  buildGroupedStorefrontProduct,
  getLocalizedSearchFields,
  normalizeStorefrontLanguage,
  sanitizeStorefrontProduct,
  trimStorefrontTranslations,
} from "../src/services/storefrontProduct.js";

test("catalog grouping selects the cheapest variant and sorts lightweight parent summaries", () => {
  const rows = [
    { _id: "a-expensive", key: "a-2", supplierProductId: "a", price: 9, stock: 2, popularity: 10, createdAt: "2026-01-01" },
    { _id: "b", key: "b-1", supplierProductId: "b", price: 7, stock: 4, popularity: 20, createdAt: "2026-01-02" },
    { _id: "a-cheap", key: "a-1", supplierProductId: "a", price: 5, stock: 3, popularity: 30, createdAt: "2026-01-03" },
  ];

  const groups = buildCatalogGroupSummaries(rows, "popular");
  assert.equal(groups.length, 2);
  assert.equal(groups[0].groupKey, "a");
  assert.equal(groups[0].representative._id, "a-cheap");
  assert.equal(groups[0].variantCount, 2);
  assert.equal(groups[0].priceMin, 5);
  assert.equal(groups[0].priceMax, 9);
  assert.equal(groups[0].stockTotal, 5);
});

test("popular catalog prioritizes video products without changing newest sorting", () => {
  const rows = [
    { _id: "popular", key: "popular", supplierProductId: "popular", price: 5, stock: 1, popularity: 999, hasVideo: false, createdAt: "2026-02-01" },
    { _id: "video", key: "video", supplierProductId: "video", price: 6, stock: 1, popularity: 1, hasVideo: true, createdAt: "2026-01-01" },
  ];

  assert.equal(buildCatalogGroupSummaries(rows, "popular")[0].groupKey, "video");
  assert.equal(buildCatalogGroupSummaries(rows, "newest")[0].groupKey, "popular");
});

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

test("storefront payload applies requested translation and keeps English fallback only", () => {
  const product = {
    key: "cj-1",
    title: "Gloves",
    description: "Warm gloves",
    categoryLabel: "Fashion",
    translations: {
      en: { title: "Gloves", description: "Warm gloves", categoryLabel: "Fashion" },
      tr: {
        title: "Eldiven",
        description: "Sıcak tutan eldiven",
        categoryLabel: "Moda",
        features: ["Yumuşak"],
      },
      de: { title: "Handschuhe" },
    },
  };

  const trimmed = trimStorefrontTranslations(product, "tr");
  assert.deepEqual(Object.keys(trimmed.translations).sort(), ["en", "tr"]);
  assert.equal(trimmed.title, "Eldiven");
  assert.equal(trimmed.description, "Sıcak tutan eldiven");
  assert.equal(trimmed.categoryLabel, "Moda");
  assert.deepEqual(trimmed.features, ["Yumuşak"]);
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

test("grouped storefront product exposes parent-level variant summary with localized title", () => {
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
  assert.equal(grouped.title, "SKMEI Saat - Altın");
  assert.equal(grouped.variantCount, 4);
  assert.equal(grouped.priceMin, 8);
  assert.equal(grouped.priceMax, 11);
  assert.equal(grouped.stock, 21);
  assert.equal(grouped.costPrice, undefined);
  assert.deepEqual(Object.keys(grouped.translations).sort(), ["en", "tr"]);
});
