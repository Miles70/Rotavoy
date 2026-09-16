import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalogSearchConditions,
  buildCatalogSearchExclusions,
  buildCatalogProductTypeCondition,
  getCatalogSearchRecommendationCategories,
  getCatalogSearchTermGroups,
} from "../src/services/catalogSearch.js";

test("Turkish storefront search expands common product words into English aliases", () => {
  const groups = getCatalogSearchTermGroups("telefon kılıfı");

  assert.equal(groups.length, 2);
  assert.ok(groups[0].includes("phone"));
  assert.ok(groups[1].includes("kılıf"));
  assert.ok(groups[1].includes("case"));
});

test("Turkish storefront search tolerates text typed without Turkish characters", () => {
  const groups = getCatalogSearchTermGroups("sarj kablosu");

  assert.ok(groups[0].includes("charger"));
  assert.ok(groups[1].includes("kablo"));
});

test("catalog search requires every meaningful word while allowing aliases across fields", () => {
  const conditions = buildCatalogSearchConditions("telefon için kılıf", [
    "title",
    "translations.tr.title",
  ]);

  assert.equal(conditions.length, 2);
  assert.ok(Array.isArray(conditions[0].$or));
  assert.ok(conditions[0].$or.some((condition) => condition.title instanceof RegExp));
  assert.ok(conditions[1].$or.some((condition) => condition["translations.tr.title"] instanceof RegExp));
});

test("search terms and translated aliases cannot match generic words in descriptions", () => {
  const conditions = buildCatalogSearchConditions("telefon kılıfı", [
    "title",
    "description",
    "translations.en.title",
    "translations.en.description",
  ]);
  const secondWordMatches = conditions[1].$or;
  const descriptionPatterns = secondWordMatches
    .filter((condition) => condition.description)
    .map((condition) => condition.description.source);
  const titlePatterns = secondWordMatches
    .filter((condition) => condition.title)
    .map((condition) => condition.title.source);

  assert.equal(descriptionPatterns.some((pattern) => pattern.includes("case")), false);
  assert.equal(descriptionPatterns.some((pattern) => pattern.includes("cover")), false);
  assert.equal(descriptionPatterns.some((pattern) => pattern.includes("kılıfı")), false);
  assert.equal(titlePatterns.some((pattern) => pattern.includes("case")), true);
  assert.equal(titlePatterns.some((pattern) => pattern.includes("cover")), true);
});

test("catalog search uses whole words and excludes products explicitly sold without a case", () => {
  const fields = ["title", "translations.tr.title", "translations.en.title"];
  const conditions = buildCatalogSearchConditions("telefon kılıfı", fields);
  const casePatterns = conditions[1].$or
    .filter((condition) => condition["translations.tr.title"])
    .map((condition) => condition["translations.tr.title"]);
  const exclusions = buildCatalogSearchExclusions("telefon kılıfı", fields);

  assert.equal(casePatterns.some((pattern) => pattern.test("Kılıfsız ekran temizleyici")), false);
  assert.equal(casePatterns.some((pattern) => pattern.test("Telefon kılıfı")), true);
  assert.ok(exclusions.some((condition) =>
    condition["translations.tr.title"]?.test("Kılıfsız ekran temizleyici"),
  ));
  assert.ok(exclusions.some((condition) =>
    condition["translations.en.title"]?.test("Phone cleaner without case"),
  ));
});

test("shoe searches exclude bags, luggage, storage products and organizers", () => {
  const fields = ["title", "translations.tr.title", "translations.en.title"];
  const exclusions = buildCatalogSearchExclusions("ayakkabı", fields);
  const rejects = [
    "Shoe Storage Bag",
    "Ayakkabı Saklama Çantası",
    "Travel Shoe Organizer",
    "Ayakkabı Rafı",
    "Shoe Suitcase Pouch",
  ];

  for (const title of rejects) {
    assert.ok(exclusions.some((condition) =>
      Object.values(condition).some((pattern) => pattern.test(title))), title);
  }
  assert.equal(exclusions.some((condition) =>
    Object.values(condition).some((pattern) => pattern.test("Kadın Spor Ayakkabı"))), false);
  assert.deepEqual(getCatalogSearchRecommendationCategories("ayakkabı"), ["fashion"]);
});

test("every search verifies the requested product type against the leaf category", () => {
  const fields = [
    "title",
    "categoryLabel",
    "translations.tr.title",
    "translations.tr.categoryLabel",
    "translations.en.title",
    "translations.en.categoryLabel",
  ];
  const bagCondition = buildCatalogProductTypeCondition("çanta", fields);
  const shoeCondition = buildCatalogProductTypeCondition("ayakkabı", fields);
  const bagPatterns = bagCondition.$or[0].$or.map((condition) => Object.values(condition)[0]);
  const shoePatterns = shoeCondition.$or[0].$or.map((condition) => Object.values(condition)[0]);

  assert.ok(bagPatterns.some((pattern) => pattern.test("Bags & Backpacks")));
  assert.equal(bagPatterns.some((pattern) => pattern.test("Women's Shoes")), false);
  assert.ok(shoePatterns.some((pattern) => pattern.test("Women's Shoes")));
  assert.equal(shoePatterns.some((pattern) => pattern.test("Bags & Backpacks")), false);
});
