import "dotenv/config";

const TARGET_NEW_PRODUCTS = Number.parseInt(
  process.env.ROTAVOY_HORECA_TARGET || "100",
  10,
);

const MAX_PASSES = Number.parseInt(
  process.env.ROTAVOY_HORECA_MAX_PASSES || "4",
  10,
);

const HORECA_KEYWORDS = [
  "disposable cups",
  "paper cups",
  "plastic cups",
  "coffee cup lid",
  "cup holder",
  "disposable plates",
  "paper plates",
  "disposable bowls",
  "disposable cutlery",
  "disposable forks spoons knives",
  "disposable food tray",
  "compartment food tray",
  "takeaway food container",
  "disposable lunch box",
  "kraft food box",
  "paper food container",
  "meal prep container",
  "aluminum foil container",
  "sauce cups",
  "food packaging",
  "takeaway packaging",
  "restaurant packaging",
  "catering supplies",
  "restaurant supplies",
  "paper napkins",
  "paper straws",
  "food wrap",
  "bakery packaging",
];

function positiveInt(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const targetNewProducts = positiveInt(TARGET_NEW_PRODUCTS, 100);
const maxPasses = positiveInt(MAX_PASSES, 4);

// Only grow the catalog. Existing CJ/manual products are preserved and any
// supplier products already stored in MongoDB are excluded from discovery.
process.env.CJ_SYNC_ONLY_NEW = "true";
process.env.CJ_REPLACE_LEGACY_CATALOG = "false";
process.env.ROTAVOY_CONTENT_ENRICH_ON_SYNC = "false";
process.env.CJ_SYNC_KEYWORDS = HORECA_KEYWORDS.join(",");
process.env.CJ_SYNC_PAGE_SIZE = process.env.ROTAVOY_HORECA_PAGE_SIZE || "100";
process.env.CJ_SYNC_MAX_PAGES_PER_KEYWORD = process.env.ROTAVOY_HORECA_MAX_PAGES || "30";
process.env.CJ_SYNC_PRODUCTS_PER_KEYWORD = process.env.ROTAVOY_HORECA_PRODUCTS_PER_KEYWORD || "15";
process.env.CJ_SYNC_BATCH_SIZE = process.env.ROTAVOY_HORECA_BATCH_SIZE || "100";

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

try {
  await connectDatabase();

  const beforeCount = await getActiveCjParentCount();
  const targetCount = beforeCount + targetNewProducts;
  process.env.CJ_SYNC_TARGET_PRODUCTS = String(targetCount);

  console.log(`Rotavoy HORECA expansion starting with ${beforeCount} active CJ products.`);
  console.log(`Target: +${targetNewProducts} disposable / restaurant-supply products (${beforeCount} -> ${targetCount}).`);

  let result = null;
  let pass = 0;

  while (pass < maxPasses) {
    pass += 1;
    console.log(`HORECA: pass ${pass}/${maxPasses}`);

    result = await syncCjCatalog();

    const currentCount = await getActiveCjParentCount();
    const added = Math.max(currentCount - beforeCount, 0);
    console.log(`HORECA: ${added}/${targetNewProducts} new active products added.`);

    if (currentCount >= targetCount) break;

    if (!result || Number(result.importedProducts || 0) < 1) {
      console.warn("HORECA: no more usable new products were found in this pass.");
      break;
    }
  }

  const afterCount = await getActiveCjParentCount();
  const added = Math.max(afterCount - beforeCount, 0);

  console.log("Rotavoy HORECA expansion complete.");
  console.log(`Active CJ catalog: ${beforeCount} -> ${afterCount} (+${added}).`);

  if (afterCount < targetCount) {
    console.warn(
      `HORECA target was not fully reached (${added}/${targetNewProducts}). Re-run cj:expand-horeca later to continue with new supplier products only.`,
    );
  }
} catch (error) {
  console.error("Rotavoy HORECA expansion failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
