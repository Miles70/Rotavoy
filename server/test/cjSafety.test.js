import assert from "node:assert/strict";
import test from "node:test";
import {
  getLegacyCatalogCleanupFilter,
  hasFreshProfessionalContent,
} from "../src/services/cjCatalogSync.js";
import { getFailureFulfillmentStatus } from "../src/services/cjFulfillment.js";

test("CJ catalog cleanup never targets manually created products", () => {
  const filter = getLegacyCatalogCleanupFilter();

  assert.deepEqual(filter, { source: "amazon-reviews-2023" });
  assert.notEqual(filter.source, "manual");
});

test("CJ sync preserves professional copy only while supplier source is unchanged", () => {
  const translations = Object.fromEntries(
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
  const existing = {
    contentMeta: { status: "ready", sourceHash: "same-hash" },
    translations,
  };

  assert.equal(hasFreshProfessionalContent(existing, "same-hash"), true);
  assert.equal(hasFreshProfessionalContent(existing, "changed-hash"), false);
});

test("ambiguous CJ fulfillment failures require manual review", () => {
  assert.equal(getFailureFulfillmentStatus(new Error("socket closed")), "manual_review");
  assert.equal(getFailureFulfillmentStatus({ statusCode: 502 }), "manual_review");
  assert.equal(getFailureFulfillmentStatus({ statusCode: 504 }), "manual_review");
});

test("definitive CJ rejection remains retryable after correction", () => {
  assert.equal(getFailureFulfillmentStatus({ statusCode: 400 }), "failed");
});
