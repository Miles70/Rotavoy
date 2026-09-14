import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCjVariantGroupMap,
  getCjVariantKind,
} from "../src/services/cjVariantGrouping.js";

test("CJ variant kinds identify pack and packaging metadata", () => {
  assert.equal(getCjVariantKind({ variantKey: "2pcs White" }), "pack-2");
  assert.equal(getCjVariantKind({ variantKey: "Black-3PCS" }), "pack-3");
  assert.equal(getCjVariantKind({ variantKey: "Gray-100PCS" }), "pack-100");
  assert.equal(getCjVariantKind({ variantKey: "Siyah 200 adet" }), "pack-200");
  assert.equal(getCjVariantKind({ variantKey: "Set2" }), "set");
  assert.equal(
    getCjVariantKind({ variantKey: "Pink Simple Packaging" }),
    "simple-packaging",
  );
  assert.equal(getCjVariantKind({ variantKey: "Blue 380ml" }), "standard");
});

test("CJ variant grouping recognizes mixed white and pink combo packages", () => {
  assert.equal(getCjVariantKind({ variantKey: "White pink" }), "pack-2-mixed");
  assert.equal(getCjVariantKind({ variantKey: "Beyaz + Pembe" }), "pack-2-mixed");
});

test("CJ grouping keeps normal size, price and pack differences on one card", () => {
  const groups = buildCjVariantGroupMap([
    { vid: "small", variantKey: "Pink 70X38cm 1PC", variantSellPrice: 3.05 },
    { vid: "medium", variantKey: "Pink 90X60cm 1PC", variantSellPrice: 6.24 },
    { vid: "large", variantKey: "Pink 120X80cm 1PC", variantSellPrice: 13.22 },
    { vid: "two", variantKey: "Pink 2PCS", variantSellPrice: 20 },
    { vid: "set", variantKey: "Set2", variantSellPrice: 30 },
  ]);

  assert.equal(groups.get("small"), "product");
  assert.equal(groups.get("medium"), "product");
  assert.equal(groups.get("large"), "product");
  assert.equal(groups.get("two"), "product");
  assert.equal(groups.get("set"), "product");
});

test("CJ grouping keeps genuine accessories separate from the main product", () => {
  const purifier = buildCjVariantGroupMap(
    [
      { vid: "main", variantKey: "White", variantSellPrice: 28 },
      { vid: "filter", variantKey: "Replacement Filter", variantSellPrice: 4 },
    ],
    { productTitle: "A1 Air Purifier" },
  );

  assert.equal(purifier.get("main"), "product");
  assert.equal(purifier.get("filter"), "accessory-filter");

  const eyebrow = buildCjVariantGroupMap(
    [
      { vid: "brown", variantKey: "Soft Brown", variantSellPrice: 3 },
      { vid: "brush", variantKey: "Eyebrow doubleended brush", variantSellPrice: 1 },
    ],
    { productTitle: "Phoera Eyebrow Cream" },
  );

  assert.equal(eyebrow.get("brown"), "product");
  assert.equal(eyebrow.get("brush"), "accessory-brush");
});

test("CJ accessory words do not split products that are themselves accessories", () => {
  const groups = buildCjVariantGroupMap(
    [
      { vid: "blue", variantKey: "Blue Filter", variantSellPrice: 3 },
      { vid: "white", variantKey: "White Filter", variantSellPrice: 4 },
    ],
    { productTitle: "Reusable Air Filter" },
  );

  assert.equal(groups.get("blue"), "product");
  assert.equal(groups.get("white"), "product");
});
