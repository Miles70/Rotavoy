import { Product } from "../models/Product.js";

const LEGACY_DEMO_KEYS = [
  "macbookPro",
  "smartWatch",
  "smartphonePro",
  "mirrorlessCamera",
  "wirelessHeadphones",
  "tabletPro",
  "bluetoothSpeaker",
  "basicTshirt",
  "runningShoes",
  "classicSunglasses",
  "urbanBackpack",
  "premiumHoodie",
  "leatherJacket",
  "deskLamp",
  "officeChair",
  "modernSofa",
  "coffeeMaker",
  "indoorPlant",
  "woodenTable",
  "gamingHeadset",
  "mechanicalKeyboard",
  "wirelessController",
  "gamingMouse",
  "gamingMonitor",
  "streamingMicrophone",
];

export async function syncProductsFromCatalog() {
  const cleanupResult = await Product.deleteMany({
    $or: [
      { source: "amazon-reviews-2023" },
      { source: "manual", key: { $in: LEGACY_DEMO_KEYS } },
    ],
  });

  return {
    matchedCount: cleanupResult.deletedCount || 0,
    modifiedCount: 0,
    upsertedCount: 0,
    deletedCount: cleanupResult.deletedCount || 0,
  };
}
