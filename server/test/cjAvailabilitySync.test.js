import assert from "node:assert/strict";
import test from "node:test";
import { buildCjAvailabilityChanges } from "../src/services/cjAvailabilitySync.js";

test("CJ availability changes deactivate removed and zero-stock variants", () => {
  const stored = [
    { _id: "available", supplierVariantId: "v1" },
    { _id: "empty", supplierVariantId: "v2" },
    { _id: "removed", supplierVariantId: "v3" },
  ];
  const supplier = [
    { vid: "v1", variantSellPrice: 10 },
    { vid: "v2", variantSellPrice: 20 },
  ];
  const stock = new Map([
    ["v1", 8],
    ["v2", 0],
  ]);

  assert.deepEqual(
    buildCjAvailabilityChanges(stored, supplier, stock, 1.65),
    [
      {
        productId: "available",
        stock: 8,
        isActive: true,
        costPrice: 10,
        price: 16.5,
        variantGroupKey: "standard-band-1",
      },
      {
        productId: "empty",
        stock: 0,
        isActive: false,
        costPrice: 20,
        price: 33,
        variantGroupKey: "standard-band-1",
      },
      {
        productId: "removed",
        stock: 0,
        isActive: false,
        variantGroupKey: "standard-band-1",
      },
    ],
  );
});

test("CJ availability changes reactivate restocked variants", () => {
  const changes = buildCjAvailabilityChanges(
    [{ _id: "restocked", supplierVariantId: "v1" }],
    [{ vid: "v1", variantSellPrice: "4.20" }],
    new Map([["v1", 3]]),
    2,
  );

  assert.deepEqual(changes, [
    {
      productId: "restocked",
      stock: 3,
      isActive: true,
      costPrice: 4.2,
      price: 8.4,
      variantGroupKey: "standard-band-1",
    },
  ]);
});
