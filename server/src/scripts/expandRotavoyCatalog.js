import "dotenv/config";

const PRODUCTS_PER_CATEGORY = Number.parseInt(
  process.env.ROTAVOY_EXPAND_PRODUCTS_PER_CATEGORY || "100",
  10,
);

const MAX_PASSES_PER_CATEGORY = Number.parseInt(
  process.env.ROTAVOY_EXPAND_MAX_PASSES || "4",
  10,
);

const CATEGORY_GROUPS = [
  {
    key: "travel",
    label: "Travel",
    keywords: [
      "travel organizer",
      "packing cubes",
      "luggage accessories",
      "passport wallet",
      "luggage tag",
      "travel bottles",
    ],
  },
  {
    key: "tech",
    label: "Tech Accessories",
    keywords: [
      "phone stand",
      "charging cable",
      "usb hub",
      "laptop stand",
      "cable organizer",
      "phone holder",
    ],
  },
  {
    key: "home",
    label: "Home Organization",
    keywords: [
      "home storage organizer",
      "drawer organizer",
      "vacuum storage bag",
      "closet organizer",
      "storage box",
      "cable management",
    ],
  },
  {
    key: "kitchen",
    label: "Kitchen",
    keywords: [
      "kitchen organizer",
      "food storage container",
      "spice organizer",
      "coffee accessories",
      "silicone kitchen tool",
      "water bottle",
    ],
  },
  {
    key: "car",
    label: "Car Accessories",
    keywords: [
      "car phone holder",
      "car seat organizer",
      "car cleaning tool",
      "car trash bin",
      "car sunshade",
      "car charging cable",
    ],
  },
  {
    key: "pet",
    label: "Pet",
    keywords: [
      "pet grooming tool",
      "interactive pet toy",
      "pet travel water bottle",
      "dog leash",
      "pet bowl",
      "pet hair remover",
    ],
  },
  {
    key: "outdoor",
    label: "Outdoor & Holiday",
    keywords: [
      "dry bag",
      "waterproof phone pouch",
      "camping light",
      "picnic blanket",
      "beach bag",
      "outdoor organizer",
    ],
  },
  {
    key: "office",
    label: "Office & Desk",
    keywords: [
      "desk organizer",
      "laptop stand",
      "cable clips",
      "mouse pad",
      "stationery organizer",
      "desk accessories",
    ],
  },
  {
    key: "lifestyle",
    label: "Gift & Lifestyle",
    keywords: [
      "led decor",
      "mug",
      "minimalist wallet",
      "keychain",
      "jewelry box",
      "desk decor",
    ],
  },
  {
    key: "fitness",
    label: "Fitness Accessories",
    keywords: [
      "resistance bands",
      "yoga accessories",
      "shaker bottle",
      "hand grip",
      "gym organizer",
      "fitness accessories",
    ],
  },
];

function positiveInt(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const categoryTarget = positiveInt(PRODUCTS_PER_CATEGORY, 100);
const maxPasses = positiveInt(MAX_PASSES_PER_CATEGORY, 4);

// This expansion only adds new CJ parent products. Existing catalog rows are
// never deleted or replaced by this script.
process.env.CJ_SYNC_ONLY_NEW = "true";
process.env.CJ_REPLACE_LEGACY_CATALOG = "false";
process.env.ROTAVOY_CONTENT_ENRICH_ON_SYNC = "false";
process.env.CJ_SYNC_PAGE_SIZE = process.env.ROTAVOY_EXPAND_PAGE_SIZE || "100";
process.env.CJ_SYNC_MAX_PAGES_PER_KEYWORD = process.env.ROTAVOY_EXPAND_MAX_PAGES || "30";
process.env.CJ_SYNC_PRODUCTS_PER_KEYWORD = process.env.ROTAVOY_EXPAND_PRODUCTS_PER_KEYWORD || "25";
process.env.CJ_SYNC_BATCH_SIZE = process.env.ROTAVOY_EXPAND_BATCH_SIZE || "100";

const [
  { connectDatabase, disconnectDatabase },
  { Product },
  { syncCjCatalog },
] = await Promise.all([
  import("../config/database.js"),
  import("../models/Product.js"),
  import("../services/cjCatalogSync.js"),
]);

async function getActiveCjParentCount() {
  const ids = await Product.distinct("supplierProductId", {
    source: "cj",
    supplierProductId: { $ne: "" },
    isActive: true,
    stock: { $gt: 0 },
  });
  return ids.filter(Boolean).length;
}

const summary = [];

try {
  await connectDatabase();

  const startingCatalogCount = await getActiveCjParentCount();
  console.log(`Rotavoy balanced expansion starting with ${startingCatalogCount} active CJ products.`);
  console.log(
    `Plan: ${CATEGORY_GROUPS.length} categories x ${categoryTarget} new products = up to ${CATEGORY_GROUPS.length * categoryTarget} new products.`,
  );

  for (const category of CATEGORY_GROUPS) {
    const beforeCount = await getActiveCjParentCount();
    const targetCount = beforeCount + categoryTarget;

    process.env.CJ_SYNC_KEYWORDS = category.keywords.join(",");
    process.env.CJ_SYNC_TARGET_PRODUCTS = String(targetCount);

    console.log(`\n=== ${category.label}: target +${categoryTarget} (${beforeCount} -> ${targetCount}) ===`);

    let result = null;
    let pass = 0;

    while (pass < maxPasses) {
      pass += 1;
      console.log(`${category.label}: pass ${pass}/${maxPasses}`);
      result = await syncCjCatalog();

      const currentCount = await getActiveCjParentCount();
      const added = Math.max(currentCount - beforeCount, 0);
      console.log(`${category.label}: ${added}/${categoryTarget} new active products added.`);

      if (currentCount >= targetCount) break;

      if (!result || Number(result.importedProducts || 0) < 1) {
        console.warn(`${category.label}: no more usable products found in this pass.`);
        break;
      }
    }

    const afterCount = await getActiveCjParentCount();
    summary.push({
      category: category.label,
      requested: categoryTarget,
      added: Math.max(afterCount - beforeCount, 0),
      before: beforeCount,
      after: afterCount,
      targetReached: afterCount >= targetCount,
    });
  }

  const endingCatalogCount = await getActiveCjParentCount();
  const totalAdded = Math.max(endingCatalogCount - startingCatalogCount, 0);

  console.log("\nRotavoy balanced catalog expansion complete.");
  console.table(summary);
  console.log(`Active CJ catalog: ${startingCatalogCount} -> ${endingCatalogCount} (+${totalAdded}).`);

  const incomplete = summary.filter((row) => !row.targetReached);
  if (incomplete.length > 0) {
    console.warn(
      `Some categories did not reach ${categoryTarget} products: ${incomplete.map((row) => `${row.category} (${row.added})`).join(", ")}. Re-run the command to continue with new products only.`,
    );
  }
} catch (error) {
  console.error("Rotavoy balanced catalog expansion failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
