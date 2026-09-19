import test from "node:test";
import assert from "node:assert/strict";
import { classifyCatalogCategory } from "../src/services/catalogCategory.js";

test("category classifier keeps mixed supplier labels in the most specific department", () => {
  assert.equal(
    classifyCatalogCategory({ categoryLabel: "Baby Clothing", title: "Cotton Bodysuit" }),
    "baby",
  );
  assert.equal(
    classifyCatalogCategory({ categoryLabel: "Car Chargers", title: "USB Fast Charger" }),
    "automotive",
  );
  assert.equal(
    classifyCatalogCategory({ categoryLabel: "Pet Bags", title: "Dog Travel Carrier Bag" }),
    "pets",
  );
  assert.equal(
    classifyCatalogCategory({ categoryLabel: "Smart Watches", title: "Bluetooth Smart Watch" }),
    "electronics",
  );
});

test("category classifier covers storefront groups that previously leaked into home", () => {
  assert.equal(
    classifyCatalogCategory({ categoryLabel: "Educational Toys", title: "Wooden Puzzle" }),
    "toys",
  );
  assert.equal(
    classifyCatalogCategory({ categoryLabel: "Grocery Food", title: "Roasted Coffee Beans" }),
    "grocery",
  );
  assert.equal(
    classifyCatalogCategory({ categoryLabel: "Arts Crafts & Hobby", title: "Model Painting Kit" }),
    "hobby",
  );
});

test("category classifier falls back to the product title for generic supplier categories", () => {
  assert.equal(
    classifyCatalogCategory({ categoryLabel: "General", title: "Wireless Bluetooth Headphones" }),
    "electronics",
  );
  assert.equal(
    classifyCatalogCategory({ categoryLabel: "", title: "Cat Litter Mat" }),
    "pets",
  );
});

test("category classifier keeps genuinely generic merchandise visible in home", () => {
  assert.equal(
    classifyCatalogCategory({ categoryLabel: "General Merchandise", title: "Everyday Utility Item" }),
    "home",
  );
});
