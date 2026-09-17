import "dotenv/config";

const HORECA_TARGET = Number.parseInt(
  process.env.ROTAVOY_HORECA_TARGET || "100",
  10,
);

const PERSONAL_CARE_TARGET = Number.parseInt(
  process.env.ROTAVOY_PERSONAL_CARE_TARGET || "100",
  10,
);

const MAX_PASSES = Number.parseInt(
  process.env.ROTAVOY_HORECA_MAX_PASSES || "4",
  10,
);

const GROUPS = [
  {
    key: "horeca",
    label: "HORECA & Packaging",
    target: HORECA_TARGET,
    keywords: [
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
    ],
  },
  {
    key: "personal-care",
    label: "Personal Care Appliances",
    target: PERSONAL_CARE_TARGET,
    keywords: [
      "electric shaver",
      "beard trimmer",
      "hair clipper",
      "hair trimmer",
      "nose hair trimmer",
      "body groomer",
      "hair dryer",
      "portable hair dryer",
      "hair straightener",
      "flat iron hair straightener",
      "curling iron",
      "hair curler",
      "hot air brush",
      "hair styling brush",
      "electric hair brush",
      "electric toothbrush",
      "facial cleansing brush",
      "electric facial massager",
      "manicure pedicure machine",
      "electric nail drill",
    ],
  },
];

function positiveInt(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const maxPasses = positiveInt(MAX_PASSES, 4);

// Only grow the catalog. Existing CJ/manual products are preserved and any
// supplier products already stored in MongoDB are excluded from discovery.
process.env.CJ_SYNC_ONLY_NEW = "true";
process.env.CJ_REPLACE_LEGACY_CATALOG = "false";
process.env.ROTAVOY_CONTENT_ENRICH_ON_SYNC = "false";
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

const summary = [];

try {
  await connectDatabase();

  const startingCatalogCount = await getActiveCjParentCount();
  const plannedTotal = GROUPS.reduce(
    (sum, group) => sum + positiveInt(group.target, 100),
    0,
  );

  console.log(`Rotavoy HORECA + personal-care expansion starting with ${startingCatalogCount} active CJ products.`);
  console.log(`Plan: up to +${plannedTotal} new products across ${GROUPS.length} groups.`);

  for (const group of GROUPS) {
    const groupTarget = positiveInt(group.target, 100);
    const beforeCount = await getActiveCjParentCount();
    const targetCount = beforeCount + groupTarget;

    process.env.CJ_SYNC_KEYWORDS = group.keywords.join(",");
    process.env.CJ_SYNC_TARGET_PRODUCTS = String(targetCount);

    console.log(`\n=== ${group.label}: target +${groupTarget} (${beforeCount} -> ${targetCount}) ===`);

    let result = null;
    let pass = 0;

    while (pass < maxPasses) {
      pass += 1;
      console.log(`${group.label}: pass ${pass}/${maxPasses}`);

      result = await syncCjCatalog();

      const currentCount = await getActiveCjParentCount();
      const added = Math.max(currentCount - beforeCount, 0);
      console.log(`${group.label}: ${added}/${groupTarget} new active products added.`);

      if (currentCount >= targetCount) break;

      if (!result || Number(result.importedProducts || 0) < 1) {
        console.warn(`${group.label}: no more usable new products were found in this pass.`);
        break;
      }
    }

    const afterCount = await getActiveCjParentCount();
    summary.push({
      group: group.label,
      requested: groupTarget,
      added: Math.max(afterCount - beforeCount, 0),
      before: beforeCount,
      after: afterCount,
      targetReached: afterCount >= targetCount,
    });
  }

  const endingCatalogCount = await getActiveCjParentCount();
  const totalAdded = Math.max(endingCatalogCount - startingCatalogCount, 0);

  console.log("\nRotavoy HORECA + personal-care expansion complete.");
  console.table(summary);
  console.log(`Active CJ catalog: ${startingCatalogCount} -> ${endingCatalogCount} (+${totalAdded}).`);

  const incomplete = summary.filter((row) => !row.targetReached);
  if (incomplete.length > 0) {
    console.warn(
      `Some groups did not fully reach their target: ${incomplete.map((row) => `${row.group} (${row.added}/${row.requested})`).join(", ")}. Re-run cj:expand-horeca later to continue with new supplier products only.`,
    );
  }
} catch (error) {
  console.error("Rotavoy HORECA + personal-care expansion failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
