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


test("category classifier uses title to disambiguate broad mixed supplier categories", () => {
  assert.equal(
    classifyCatalogCategory({ categoryLabel: "Home & Garden", title: "Kitchen Storage Organizer" }),
    "home",
  );
  assert.equal(
    classifyCatalogCategory({ categoryLabel: "Home & Garden", title: "Garden Power Tool Set" }),
    "tools",
  );
});


test("category classifier respects strong CJ department taxonomy", () => {
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Pet Supplies > Pet Toys > Pet Plush Toys",
      title: "Dog Plush Toy",
    }),
    "pets",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Automobiles & Motorcycles > Tools, Maintenance & Care > Paint Care",
      title: "Car Wax Polishing Tool",
    }),
    "automotive",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Sports & Outdoors > Sportswear > Pants",
      title: "Men's Running Pants",
    }),
    "sports",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Consumer Electronics > Smart Electronics > Smart Watches",
      title: "LED Digital Watch",
    }),
    "electronics",
  );
});

test("category classifier routes CJ household and children taxonomy by branch", () => {
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Home & Garden, Furniture / Home Textiles / Bedding Sets",
      title: "Cooling Summer Blanket",
    }),
    "home",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Home Improvement > Home Appliances > Kitchen Appliances",
      title: "Heating Lunch Box",
    }),
    "appliances",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Toys, Kids & Baby > Baby Clothing > Baby Rompers",
      title: "Baby Romper",
    }),
    "baby",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Toys, Kids & Baby > Toys & Hobbies > Action & Toy Figures",
      title: "Dinosaur Water Gun Toy",
    }),
    "toys",
  );
});


test("category classifier handles supplier taxonomy edge cases found by the catalog audit", () => {
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Toys, Kids & Baby > Baby & Mother > Activity & Gear",
      title: "Child Safety Seat For Tourist Car",
    }),
    "baby",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Toys, Kids & Baby > Baby Clothing > Baby Accessories",
      title: "American Girl Doll 18 Inch Solid Color Stockings",
    }),
    "toys",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Toys, Kids & Baby > Toys & Hobbies > Electronic Pets",
      title: "Square Bluetooth anti-lost device",
    }),
    "electronics",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Pet Supplies > Pet Outdoor Supplies > Pet Guardrails",
      title: "Outsunny Galvanized Raised Garden Bed With Mini Greenhouse Cover",
    }),
    "tools",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Home & Garden, Furniture > Home Storage > Home Office Storage",
      title: "PU Leather Notebooks Office Leaflet Notepad",
    }),
    "office",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Home & Garden, Furniture > Arts, Crafts & Sewing > Decor Paintings",
      title: "4 FT White Artificial Christmas Tree With Pot Stand",
    }),
    "home",
  );
});


test("category classifier rescues noisy CJ home-office and home-improvement branches", () => {
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Home, Garden & Furniture > Home Storage > Home Office Storage",
      title: "Portable Wireless Rechargeable Baby Bottle Warmer USB Charging",
    }),
    "baby",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Home, Garden & Furniture > Home Storage > Home Office Storage",
      title: "800ml Dogs Water Bottle Portable Leakproof Pet Drinking Bowl",
    }),
    "pets",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Home, Garden & Furniture > Home Storage > Home Office Storage",
      title: "Rocket Launcher Toys Outdoor Water Spray Toy For Kids",
    }),
    "toys",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Home, Garden & Furniture > Home Storage > Home Office Storage",
      title: "2 In1 Car Heating Cooling Cup 12V Smart Car Cup Holder",
    }),
    "automotive",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Home Improvement > Outdoor Lighting > Flashlights & Torches",
      title: "Cartoon Projection Flashlight Toy Projector Baby Toys",
    }),
    "baby",
  );
});

test("category classifier keeps supplements out of grocery unless the title is actual food or drink", () => {
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Health, Beauty & Hair > Food & Health > Health Care Products",
      title: "Lutein Capsules",
    }),
    "beauty",
  );
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Health, Beauty & Hair > Food & Health > Health Care Products",
      title: "Mushroom Coffee",
    }),
    "grocery",
  );
});

test("category classifier treats finished wall decor as home instead of hobby", () => {
  assert.equal(
    classifyCatalogCategory({
      categoryLabel: "Home, Garden & Furniture > Arts, Crafts & Sewing > Decor Paintings",
      title: "Creative Butterfly Theme Home Wall Decoration Acrylic Hanging Painting",
    }),
    "home",
  );
});

test("category classifier keeps genuinely generic merchandise visible in home", () => {
  assert.equal(
    classifyCatalogCategory({ categoryLabel: "General Merchandise", title: "Everyday Utility Item" }),
    "home",
  );
});
