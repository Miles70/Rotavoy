import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCjVariantGroupMap,
  getCjVariantKind,
} from "../src/services/cjVariantGrouping.js";

test("CJ variant kinds separate bundles, sets and simple packaging", () => {
  assert.equal(getCjVariantKind({ variantKey: "2pcs White" }), "pack-2");
  assert.equal(getCjVariantKind({ variantKey: "Set2" }), "set");
  assert.equal(getCjVariantKind({ variantKey: "Pink Simple Packaging" }), "simple-packaging");
  assert.equal(getCjVariantKind({ variantKey: "Blue 380ml" }), "standard");
});

test("CJ variant grouping recognizes mixed white and pink combo packages", () => {
  assert.equal(getCjVariantKind({ variantKey: "White pink" }), "pack-2-mixed");
  assert.equal(getCjVariantKind({ variantKey: "Beyaz + Pembe" }), "pack-2-mixed");
});

test("CJ variant grouping separates extreme prices inside the same kind", () => {
  const groups = buildCjVariantGroupMap([
    { vid: "blue-380", variantKey: "Blue 380ml", variantSellPrice: 1.73 },
    { vid: "blue-420", variantKey: "Blue 420ml", variantSellPrice: 1.74 },
    { vid: "white", variantKey: "White", variantSellPrice: 12.78 },
    { vid: "pink", variantKey: "Pink", variantSellPrice: 17.19 },
    { vid: "black", variantKey: "Black", variantSellPrice: 29.02 },
    { vid: "two-white", variantKey: "2pcs White", variantSellPrice: 25.55 },
    { vid: "set-1", variantKey: "Set1", variantSellPrice: 13.91 },
    { vid: "simple", variantKey: "White Simple Packaging", variantSellPrice: 15.22 },
  ]);

  assert.equal(groups.get("blue-380"), groups.get("blue-420"));
  assert.notEqual(groups.get("blue-380"), groups.get("white"));
  assert.equal(groups.get("white"), groups.get("pink"));
  assert.notEqual(groups.get("white"), groups.get("black"));
  assert.match(groups.get("two-white"), /^pack-2-/);
  assert.match(groups.get("set-1"), /^set-/);
  assert.match(groups.get("simple"), /^simple-packaging-/);
});
