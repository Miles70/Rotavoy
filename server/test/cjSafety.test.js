import assert from "node:assert/strict";
import test from "node:test";
import { getLegacyCatalogCleanupFilter } from "../src/services/cjCatalogSync.js";
import { getFailureFulfillmentStatus } from "../src/services/cjFulfillment.js";

test("CJ catalog cleanup never targets manually created products", () => {
  const filter = getLegacyCatalogCleanupFilter();

  assert.deepEqual(filter, { source: "amazon-reviews-2023" });
  assert.notEqual(filter.source, "manual");
});

test("ambiguous CJ fulfillment failures require manual review", () => {
  assert.equal(getFailureFulfillmentStatus(new Error("socket closed")), "manual_review");
  assert.equal(getFailureFulfillmentStatus({ statusCode: 502 }), "manual_review");
  assert.equal(getFailureFulfillmentStatus({ statusCode: 504 }), "manual_review");
});

test("definitive CJ rejection remains retryable after correction", () => {
  assert.equal(getFailureFulfillmentStatus({ statusCode: 400 }), "failed");
});
