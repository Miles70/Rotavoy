import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseSharedContentOwner,
  compactVariantSupplierContent,
  compactVariantTranslations,
  mergeSharedProductContent,
} from "../src/services/cjProductStorage.js";

test("compact CJ sibling translations keep searchable variant fields but drop heavy shared copy", () => {
  const compact = compactVariantTranslations({
    en: {
      title: "Travel Bottle - Blue",
      description: "A long shared product description.",
      categoryLabel: "Travel > Bottles",
      variant: "Blue",
      features: ["BPA-free", "Leak-resistant"],
    },
  });

  assert.deepEqual(compact, {
    en: {
      title: "Travel Bottle - Blue",
      description: "",
      categoryLabel: "Travel > Bottles",
      variant: "Blue",
    },
  });
});

test("compact CJ sibling supplier content keeps only variant-specific facts", () => {
  const compact = compactVariantSupplierContent({
    title: "Travel Bottle",
    description: "Shared copy",
    categoryLabel: "Travel > Bottles",
    variant: "Blue / 500 ml",
    facts: {
      material: "Steel",
      packingList: "Bottle",
      variantSku: "BLUE500",
      variantWeightGrams: 420,
      originCountry: "CN",
    },
  });

  assert.equal(compact.variant, "Blue / 500 ml");
  assert.deepEqual(compact.facts, {
    variantSku: "BLUE500",
    variantWeightGrams: 420,
    originCountry: "CN",
  });
});

test("shared CJ content hydrates a compact clicked variant without replacing its identity", () => {
  const owner = {
    key: "cj-owner",
    title: "Travel Bottle - Black",
    description: "Shared description",
    features: ["Feature one"],
    imageUrl: "https://img.example/black.jpg",
    images: ["https://img.example/detail.jpg"],
    videoUrl: "https://video.example/item.mp4",
    videoPosterUrl: "https://img.example/poster.jpg",
    hasVideo: true,
    translations: {
      tr: {
        title: "Seyahat Şişesi - Siyah",
        description: "Ortak açıklama",
        categoryLabel: "Seyahat > Şişeler",
        variant: "Siyah",
        features: ["Özellik bir"],
      },
    },
  };
  const variant = {
    key: "cj-blue",
    title: "Travel Bottle - Blue",
    description: "",
    features: [],
    imageUrl: "https://img.example/blue.jpg",
    images: ["https://img.example/blue.jpg"],
    translations: {
      tr: {
        title: "Seyahat Şişesi - Mavi",
        description: "",
        categoryLabel: "Seyahat > Şişeler",
        variant: "Mavi",
      },
    },
  };

  const hydrated = mergeSharedProductContent(variant, owner);
  assert.equal(hydrated.key, "cj-blue");
  assert.equal(hydrated.title, "Travel Bottle - Blue");
  assert.equal(hydrated.description, "Shared description");
  assert.deepEqual(hydrated.features, ["Feature one"]);
  assert.equal(hydrated.translations.tr.title, "Seyahat Şişesi - Mavi");
  assert.equal(hydrated.translations.tr.description, "Ortak açıklama");
  assert.deepEqual(hydrated.translations.tr.features, ["Özellik bir"]);
  assert.deepEqual(hydrated.images, [
    "https://img.example/blue.jpg",
    "https://img.example/black.jpg",
    "https://img.example/detail.jpg",
  ]);
  assert.equal(hydrated.videoUrl, "https://video.example/item.mp4");
});

test("owner selection preserves an explicitly marked CJ shared content owner", () => {
  const owner = { key: "owner", sharedContentOwner: true, isActive: false };
  const active = {
    key: "active",
    isActive: true,
    description: "Longer active copy",
    contentMeta: { status: "ready" },
  };

  assert.equal(chooseSharedContentOwner([active, owner]), owner);
});
