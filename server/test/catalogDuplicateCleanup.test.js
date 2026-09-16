import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseDuplicateSurvivor,
  duplicateCandidateScore,
} from "../src/services/catalogDuplicateCleanup.js";

test("prefers an active, stocked and enriched duplicate", () => {
  const incomplete = {
    key: "old",
    isActive: true,
    stock: 0,
    contentMeta: {},
    translations: {},
  };
  const ready = {
    key: "ready",
    isActive: true,
    stock: 8,
    imageUrl: "https://example.com/product.jpg",
    description: "Complete product",
    contentMeta: { status: "ready", version: "rotavoy-ai-copy-v8" },
    translations: Object.fromEntries(
      ["en", "tr", "ru", "ar", "zh", "es", "pt", "fr", "de", "it"].map((language) => [
        language,
        { title: "Title", description: "Description", categoryLabel: "Category", variant: "Default" },
      ]),
    ),
  };

  assert.ok(duplicateCandidateScore(ready) > duplicateCandidateScore(incomplete));
  assert.equal(chooseDuplicateSurvivor([incomplete, ready]).key, "ready");
});

test("uses the key as a deterministic final tie breaker", () => {
  const left = { key: "a", updatedAt: "2026-01-01T00:00:00.000Z" };
  const right = { key: "b", updatedAt: "2026-01-01T00:00:00.000Z" };
  assert.equal(chooseDuplicateSurvivor([right, left]).key, "a");
});
