import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalogSearchConditions,
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

test("translated aliases cannot match generic words in product descriptions", () => {
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

  assert.equal(descriptionPatterns.includes("case"), false);
  assert.equal(descriptionPatterns.includes("cover"), false);
  assert.equal(titlePatterns.includes("case"), true);
  assert.equal(titlePatterns.includes("cover"), true);
});
