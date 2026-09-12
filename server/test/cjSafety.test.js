import assert from "node:assert/strict";
import test from "node:test";
import {
  extractCjDescriptionImageUrls,
  getLegacyCatalogCleanupFilter,
  hasFreshProfessionalContent,
  shouldPreserveExistingTranslations,
} from "../src/services/cjCatalogSync.js";
import { getFailureFulfillmentStatus } from "../src/services/cjFulfillment.js";

function completeTranslations() {
  return Object.fromEntries(
    ["en", "tr", "ru", "ar", "zh", "es", "pt", "fr", "de", "it"].map((language) => [
      language,
      {
        title: "Title",
        description: "Description",
        categoryLabel: "Category",
        variant: "Default",
      },
    ]),
  );
}

test("CJ catalog cleanup never targets manually created products", () => {
  const filter = getLegacyCatalogCleanupFilter();

  assert.deepEqual(filter, { source: "amazon-reviews-2023" });
  assert.notEqual(filter.source, "manual");
});

test("CJ sync preserves professional copy only while supplier source is unchanged", () => {
  const existing = {
    contentMeta: { status: "ready", sourceHash: "same-hash" },
    translations: completeTranslations(),
  };

  assert.equal(hasFreshProfessionalContent(existing, "same-hash"), true);
  assert.equal(hasFreshProfessionalContent(existing, "changed-hash"), false);
});

test("CJ sync keeps existing complete translations when translation provider returns a partial bundle", () => {
  const existing = { translations: completeTranslations() };
  const throttledBundle = {
    en: {
      title: "New title",
      description: "New description",
      categoryLabel: "New category",
      variants: ["Default"],
    },
  };

  assert.equal(shouldPreserveExistingTranslations(existing, throttledBundle), true);
  assert.equal(shouldPreserveExistingTranslations(existing, completeTranslations()), false);
});

test("CJ gallery extraction keeps description images, removes duplicates and ignores unsafe URLs", () => {
  const html = `
    <p>
      <img src="https://cdn.example.com/one.jpg" />
      <img data-src='https://cdn.example.com/two.jpg?x=1&amp;y=2' />
      <img src="https://cdn.example.com/one.jpg" />
      <img src="javascript:alert(1)" />
    </p>
  `;

  assert.deepEqual(extractCjDescriptionImageUrls(html), [
    "https://cdn.example.com/one.jpg",
    "https://cdn.example.com/two.jpg?x=1&y=2",
  ]);
});

test("ambiguous CJ fulfillment failures require manual review", () => {
  assert.equal(getFailureFulfillmentStatus(new Error("socket closed")), "manual_review");
  assert.equal(getFailureFulfillmentStatus({ statusCode: 502 }), "manual_review");
  assert.equal(getFailureFulfillmentStatus({ statusCode: 504 }), "manual_review");
});

test("definitive CJ rejection remains retryable after correction", () => {
  assert.equal(getFailureFulfillmentStatus({ statusCode: 400 }), "failed");
});
