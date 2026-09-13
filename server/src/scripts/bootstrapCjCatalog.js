import "dotenv/config";

const DEFAULT_BOOTSTRAP_KEYWORDS = [
  "travel",
  "electronics",
  "home",
  "beauty",
  "sports",
  "fashion",
  "baby",
  "pets",
  "automotive",
  "tools",
  "office",
  "gaming",
].join(",");

// Respect CJ_TRANSLATE_PRODUCTS from the server environment. Disabling it here
// made newly bootstrapped products permanently fall back to English even when
// the storefront language was Turkish (or another supported language).
process.env.ROTAVOY_CONTENT_ENRICH_ON_SYNC = "false";
process.env.CJ_SYNC_ONLY_NEW = "true";
process.env.CJ_SYNC_TARGET_PRODUCTS = process.env.CJ_BOOTSTRAP_TARGET_PRODUCTS || "500";
process.env.CJ_SYNC_KEYWORDS = process.env.CJ_BOOTSTRAP_KEYWORDS || DEFAULT_BOOTSTRAP_KEYWORDS;
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
