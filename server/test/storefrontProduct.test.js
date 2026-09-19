import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalogGroupSummaries,
  buildGroupedStorefrontProduct,
  getAllLocalizedSearchFields,
  getLocalizedSearchFields,
  normalizeStorefrontLanguage,
  rankRelatedCatalogGroups,
  sanitizeStorefrontProduct,
  trimStorefrontTranslations,
} from "../src/services/storefrontProduct.js";

test("related products prioritize semantic accessories from the same supplier family", () => {
  const current = {
    key: "purifier-white",
    title: "A1 Air Purifier",
    categoryKey: "appliances",
    supplierProductId: "purifier",
    variantGroupKey: "product",
    imageUrl: "https://img.example/purifier.jpg",
  };

  const rows = [
    { _id: "current", key: "purifier-white", title: current.title, categoryKey: "appliances", supplierProductId: "purifier", variantGroupKey: "product", imageUrl: "https://img.example/purifier.jpg", price: 28, stock: 2 },
    { _id: "filter", key: "replacement-filter", title: "A1 Replacement Filter", categoryKey: "appliances", supplierProductId: "purifier", variantGroupKey: "accessory-filter", imageUrl: "https://img.example/filter.jpg", price: 4, stock: 2 },
    { _id: "lamp", key: "night-lamp", title: "LED Night Lamp", categoryKey: "appliances", supplierProductId: "lamp", variantGroupKey: "product", price: 8, stock: 2, popularity: 999 },
  ];

  const ranked = rankRelatedCatalogGroups(
    current,
    buildCatalogGroupSummaries(rows),
    8,
  );

  assert.equal(ranked[0].groupKey, "purifier:image:https://img.example/filter.jpg");
  assert.equal(
    ranked.some((group) => group.groupKey === "purifier:image:https://img.example/purifier.jpg"),
    false,
  );
});

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

test("catalog grouping keeps ordinary variants on one card and accessories separate", () => {
  const rows = [
    { _id: "small", key: "small", supplierProductId: "mat", variantGroupKey: "product", imageUrl: "https://img.example/mat.jpg", price: 3.05, stock: 2 },
    { _id: "medium", key: "medium", supplierProductId: "mat", variantGroupKey: "product", imageUrl: "https://img.example/mat.jpg", price: 6.24, stock: 2 },
    { _id: "large", key: "large", supplierProductId: "mat", variantGroupKey: "product", imageUrl: "https://img.example/mat.jpg", price: 13.22, stock: 2 },
    { _id: "pack", key: "pack", supplierProductId: "mat", variantGroupKey: "product", imageUrl: "https://img.example/mat.jpg", price: 20, stock: 2 },
    { _id: "filter", key: "filter", supplierProductId: "mat", variantGroupKey: "accessory-filter", imageUrl: "https://img.example/filter.jpg", price: 2, stock: 2 },
  ];

  const groups = buildCatalogGroupSummaries(rows);

  assert.equal(groups.length, 2);
  assert.equal(
    groups.find((group) => group.groupKey === "mat:image:https://img.example/mat.jpg").variantCount,
    4,
  );
  assert.equal(
    groups.find((group) => group.groupKey === "mat:image:https://img.example/filter.jpg").variantCount,
    1,
  );
});


test("catalog grouping keeps different primary images as separate visual cards", () => {
  const groups = buildCatalogGroupSummaries([
    { _id: "black-39", key: "black-39", supplierProductId: "shoe", imageUrl: "https://img.example/black.jpg", price: 10, stock: 2 },
    { _id: "black-40", key: "black-40", supplierProductId: "shoe", imageUrl: "https://img.example/black.jpg", price: 11, stock: 3 },
    { _id: "white-39", key: "white-39", supplierProductId: "shoe", imageUrl: "https://img.example/white.jpg", price: 12, stock: 4 },
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups.find((group) => group.groupKey.includes("black.jpg")).variantCount, 2);
  assert.equal(groups.find((group) => group.groupKey.includes("white.jpg")).variantCount, 1);
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

test("global storefront search covers every supported product language", () => {
  const fields = getAllLocalizedSearchFields();
  for (const language of ["en", "tr", "ru", "ar", "zh", "es", "pt", "fr", "de", "it"]) {
    assert.ok(fields.includes(`translations.${language}.title`));
    assert.ok(fields.includes(`translations.${language}.description`));
  }
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
