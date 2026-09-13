import assert from "node:assert/strict";
import test from "node:test";
import {
  getCampaignProductGroupKey,
  localizeCampaignProduct,
  normalizeCampaignLanguage,
  pickUniqueCampaignProducts,
} from "../src/services/campaignProduct.js";

test("campaign language is constrained to Rotavoy languages", () => {
  assert.equal(normalizeCampaignLanguage("TR"), "tr");
  assert.equal(normalizeCampaignLanguage("xx"), "en");
});

test("campaign cards collapse sibling CJ variants by supplier product id", () => {
  const products = [
    { key: "blue", supplierProductId: "pid-1" },
    { key: "pink", supplierProductId: "pid-1" },
    { key: "other", supplierProductId: "pid-2" },
  ];

  const selected = pickUniqueCampaignProducts(products, { limit: 3 });

  assert.deepEqual(selected.map((product) => product.key), ["blue", "other"]);
  assert.equal(getCampaignProductGroupKey(products[0]), "supplier:pid-1");
});

test("campaign products use requested localized copy when available", () => {
  const product = {
    title: "Travel Bag",
    description: "English source copy",
    categoryLabel: "Bags",
    translations: {
      tr: {
        title: "Seyahat Çantası",
        description: "Türkçe ürün açıklaması",
        categoryLabel: "Çantalar",
      },
    },
  };

  const localized = localizeCampaignProduct(product, "tr");

  assert.equal(localized.title, "Seyahat Çantası");
  assert.equal(localized.description, "Türkçe ürün açıklaması");
  assert.equal(localized.categoryLabel, "Çantalar");
});
