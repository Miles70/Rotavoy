import "dotenv/config";

const DEFAULT_BOOTSTRAP_KEYWORDS = [
  "phone stand",
  "charging cable",
  "cable organizer",
  "desk organizer",
  "home storage organizer",
  "kitchen organizer",
  "food storage container",
  "cleaning brush",
  "microfiber cleaning cloth",
  "laundry organizer",
  "pet grooming tool",
  "interactive pet toy",
  "travel organizer",
  "packing cubes",
  "car seat organizer",
  "car cleaning tool",
  "resistance bands",
  "yoga accessories",
  "hair accessories",
  "makeup organizer",
  "baby safety product",
  "household hand tools",
  "gardening hand tools",
  "reusable shopping bag",
  "water bottle",
].join(",");

// Respect CJ_TRANSLATE_PRODUCTS from the server environment. Disabling it here
// made newly bootstrapped products permanently fall back to English even when
// the storefront language was Turkish (or another supported language).
process.env.ROTAVOY_CONTENT_ENRICH_ON_SYNC = "false";
process.env.CJ_SYNC_ONLY_NEW = "true";
// A bootstrap only grows the catalog. Existing CJ, manual and legacy products
// must remain available unless an administrator deliberately cleans them up.
process.env.CJ_REPLACE_LEGACY_CATALOG = "false";
process.env.CJ_SYNC_TARGET_PRODUCTS = process.env.CJ_BOOTSTRAP_TARGET_PRODUCTS || "500";
process.env.CJ_SYNC_KEYWORDS = process.env.CJ_BOOTSTRAP_PRIORITY_KEYWORDS || DEFAULT_BOOTSTRAP_KEYWORDS;
process.env.CJ_SYNC_PRODUCTS_PER_KEYWORD = process.env.CJ_BOOTSTRAP_PRODUCTS_PER_KEYWORD || "30";
process.env.CJ_SYNC_PAGE_SIZE = process.env.CJ_BOOTSTRAP_PAGE_SIZE || "100";
process.env.CJ_SYNC_MAX_PAGES_PER_KEYWORD = process.env.CJ_BOOTSTRAP_MAX_PAGES_PER_KEYWORD || "20";
process.env.CJ_SYNC_BATCH_SIZE = process.env.CJ_BOOTSTRAP_BATCH_SIZE || "100";
process.env.CJ_SYNC_VARIANTS_PER_PRODUCT = process.env.CJ_BOOTSTRAP_VARIANTS_PER_PRODUCT || "12";

const [{ connectDatabase, disconnectDatabase }, { syncCjCatalog }] = await Promise.all([
  import("../config/database.js"),
  import("../services/cjCatalogSync.js"),
]);

try {
  await connectDatabase();
  const result = await syncCjCatalog();
  console.log("CJ catalog bootstrap complete:", JSON.stringify(result, null, 2));

  if (!result.targetReached) {
    console.warn(
      `CJ catalog target was not reached in this pass (${result.activeCatalogProducts}/${result.catalogTarget}). Run cj:bootstrap again to continue from products already stored in MongoDB.`,
    );
  }
} catch (error) {
  console.error("CJ catalog bootstrap failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
