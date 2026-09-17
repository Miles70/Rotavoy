import assert from "node:assert/strict";
import test from "node:test";
import {
  clearStorefrontResponseCache,
  readStorefrontResponseCache,
  withStorefrontResponseCache,
  writeStorefrontResponseCache,
} from "../src/services/storefrontResponseCache.js";

test("storefront response cache stores and clears values", () => {
  clearStorefrontResponseCache();
  writeStorefrontResponseCache("catalog:test", { ok: true });

  assert.deepEqual(readStorefrontResponseCache("catalog:test"), { ok: true });
  clearStorefrontResponseCache("catalog:");
  assert.equal(readStorefrontResponseCache("catalog:test"), null);
});

test("storefront response cache deduplicates concurrent work", async () => {
  clearStorefrontResponseCache();
  let calls = 0;
  const factory = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return { value: 42 };
  };

  const [first, second] = await Promise.all([
    withStorefrontResponseCache("catalog:shared", factory),
    withStorefrontResponseCache("catalog:shared", factory),
  ]);

  assert.equal(calls, 1);
  assert.deepEqual(first, { value: 42 });
  assert.deepEqual(second, { value: 42 });
});
