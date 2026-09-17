import "dotenv/config";

const TARGET_PER_GROUP = Number.parseInt(
  process.env.ROTAVOY_WAVE2_TARGET_PER_GROUP || "100",
  10,
);

const MAX_PASSES = Number.parseInt(
  process.env.ROTAVOY_WAVE2_MAX_PASSES || "4",
  10,
);

const GROUPS = [
  {
    key: "horeca-packaging",
    label: "HORECA & Packaging",
    keywords: [
      "disposable cups",
      "paper cups",
      "coffee cup lid",
      "disposable plates",
      "disposable bowls",
      "disposable cutlery",
      "compartment food tray",
      "takeaway food container",
      "kraft food box",
      "aluminum foil container",
      "sauce cups",
      "restaurant packaging",
      "bakery packaging",
      "paper napkins",
      "paper straws",
    ],
  },
  {
    key: "personal-care-appliances",
    label: "Personal Care Appliances",
    keywords: [
      "electric shaver",
      "beard trimmer",
      "hair clipper",
      "nose hair trimmer",
      "body groomer",
      "hair dryer",
      "hair straightener",
      "curling iron",
      "hot air brush",
      "electric toothbrush",
      "facial cleansing brush",
      "electric facial massager",
      "electric nail drill",
      "manicure pedicure machine",
    ],
  },
  {
    key: "baby-parenting",
    label: "Baby & Parenting Essentials",
    keywords: [
      "baby bib",
      "baby feeding set",
      "baby bottle brush",
      "baby bottle drying rack",
      "baby stroller organizer",
      "stroller accessories",
      "baby diaper bag organizer",
      "baby changing mat",
      "baby bath accessories",
      "baby food storage",
      "baby teether",
      "baby safety cabinet lock",
      "baby corner protector",
      "baby nursery organizer",
    ],
  },
  {
    key: "cleaning-laundry",
    label: "Cleaning & Laundry",
    keywords: [
      "microfiber cleaning cloth",
      "cleaning brush",
      "electric cleaning brush",
      "lint roller",
      "electric lint remover",
      "laundry bag",
      "mesh laundry bag",
      "dryer balls",
      "shoe washing bag",
      "window cleaning tool",
      "dish cleaning brush",
      "dust cleaning tool",
      "mop accessories",
      "cleaning gloves",
    ],
  },
  {
    key: "bathroom-essentials",
    label: "Bathroom Essentials",
    keywords: [
      "soap dispenser",
      "automatic soap dispenser",
      "shower caddy",
      "toothbrush holder",
      "bathroom organizer",
      "toilet brush",
      "bathroom shelf",
      "towel holder",
      "shower curtain accessories",
      "drain strainer",
      "silicone drain cover",
      "bath mat",
      "bathroom hooks",
      "hair catcher drain",
    ],
  },
  {
    key: "diy-home-improvement",
    label: "DIY & Home Improvement",
    keywords: [
      "screwdriver set",
      "precision screwdriver",
      "measuring tape",
      "drill bit set",
      "hex key set",
      "utility knife",
      "tool organizer",
      "cable ties",
      "adhesive hooks",
      "double sided tape",
      "furniture repair tool",
      "wall repair tool",
      "silicone caulking tool",
      "home repair kit",
    ],
  },
  {
    key: "lighting-smart-home",
    label: "Lighting & Smart Home",
    keywords: [
      "motion sensor light",
      "led night light",
      "led strip light",
      "usb desk lamp",
      "closet light",
      "cabinet light",
      "solar garden light",
      "smart plug",
      "smart light bulb",
      "door sensor alarm",
      "wireless doorbell",
      "remote control light",
      "rechargeable lamp",
      "reading light",
    ],
  },
  {
    key: "bedding-home-textiles",
    label: "Bedding & Home Textiles",
    keywords: [
      "pillow cover",
      "satin pillowcase",
      "mattress protector",
      "bed sheet",
      "blanket",
      "throw blanket",
      "blackout curtain",
      "curtain accessories",
      "table runner",
      "table cloth",
      "cushion cover",
      "sofa cover",
      "chair cover",
      "laundry basket fabric",
    ],
  },
  {
    key: "school-stationery",
    label: "School & Stationery",
    keywords: [
      "notebook",
      "gel pen set",
      "mechanical pencil",
      "highlighter set",
      "pencil case",
      "file folder",
      "document organizer",
      "stapler",
      "staple remover",
      "binder clips",
      "paper clips",
      "sticky notes",
      "desk calendar",
      "label stickers",
    ],
  },
  {
    key: "crafts-sewing",
    label: "Crafts & Sewing",
    keywords: [
      "sewing kit",
      "crochet hook set",
      "knitting accessories",
      "embroidery kit",
      "craft scissors",
      "cutting mat",
      "craft storage box",
      "beading kit",
      "jewelry making tools",
      "painting brush set",
      "acrylic painting tools",
      "scrapbooking supplies",
      "fabric clips",
      "thread organizer",
    ],
  },
  {
    key: "gaming-accessories",
    label: "Gaming Accessories",
    keywords: [
      "game controller stand",
      "controller charging dock",
      "gaming mouse pad",
      "gaming headset stand",
      "gaming cable organizer",
      "controller grip",
      "thumbstick caps",
      "console dust cover",
      "game card storage",
      "switch accessories",
      "steam deck accessories",
      "gaming desk accessories",
      "rgb gaming light",
      "gaming phone cooler",
    ],
  },
  {
    key: "garden-plant-care",
    label: "Garden & Plant Care",
    keywords: [
      "plant watering tool",
      "self watering planter",
      "plant mister",
      "garden hand tools",
      "pruning shears",
      "plant support clips",
      "plant ties",
      "grow bag",
      "garden gloves",
      "soil moisture meter",
      "seedling tray",
      "watering nozzle",
      "garden hose accessories",
      "plant pot accessories",
    ],
  },
  {
    key: "cycling-mobility",
    label: "Cycling & Mobility Accessories",
    keywords: [
      "bike phone holder",
      "bike light",
      "bicycle repair kit",
      "bike saddle bag",
      "bike handlebar bag",
      "bike bottle holder",
      "bicycle mirror",
      "bike bell",
      "bike lock",
      "bike pump",
      "bike mudguard",
      "bicycle cleaning tool",
      "reflective cycling accessories",
      "scooter accessories",
    ],
  },
  {
    key: "small-home-appliances",
    label: "Small Home Appliances",
    keywords: [
      "handheld vacuum cleaner",
      "mini vacuum cleaner",
      "garment steamer",
      "portable fan",
      "desk fan",
      "mini humidifier",
      "milk frother",
      "electric food chopper",
      "portable blender",
      "electric coffee grinder",
      "mini heat sealer",
      "vacuum sealer",
      "electric scrubber",
      "portable air pump",
    ],
  },
  {
    key: "bags-carry",
    label: "Bags & Carry Accessories",
    keywords: [
      "messenger bag",
      "crossbody bag",
      "tote bag",
      "travel pouch",
      "tech pouch",
      "cable pouch",
      "wallet",
      "card holder",
      "coin purse",
      "laptop sleeve",
      "tablet sleeve",
      "packing pouch",
      "cosmetic bag",
      "document bag",
    ],
  },
];

function positiveInt(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const targetPerGroup = positiveInt(TARGET_PER_GROUP, 100);
const maxPasses = positiveInt(MAX_PASSES, 4);

// Wave 2 only grows the catalog. Existing CJ/manual products are preserved,
// and CJ supplier products already stored in MongoDB are excluded.
process.env.CJ_SYNC_ONLY_NEW = "true";
process.env.CJ_REPLACE_LEGACY_CATALOG = "false";
process.env.ROTAVOY_CONTENT_ENRICH_ON_SYNC = "false";
process.env.CJ_SYNC_PAGE_SIZE = process.env.ROTAVOY_WAVE2_PAGE_SIZE || "100";
process.env.CJ_SYNC_MAX_PAGES_PER_KEYWORD = process.env.ROTAVOY_WAVE2_MAX_PAGES || "30";
process.env.CJ_SYNC_PRODUCTS_PER_KEYWORD = process.env.ROTAVOY_WAVE2_PRODUCTS_PER_KEYWORD || "20";
process.env.CJ_SYNC_BATCH_SIZE = process.env.ROTAVOY_WAVE2_BATCH_SIZE || "100";

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
  const plannedTotal = GROUPS.length * targetPerGroup;

  console.log(`Rotavoy Wave 2 expansion starting with ${startingCatalogCount} active CJ products.`);
  console.log(`Plan: ${GROUPS.length} demand-led groups x ${targetPerGroup} products = up to +${plannedTotal} new products.`);

  for (const group of GROUPS) {
    const beforeCount = await getActiveCjParentCount();
    const targetCount = beforeCount + targetPerGroup;

    process.env.CJ_SYNC_KEYWORDS = group.keywords.join(",");
    process.env.CJ_SYNC_TARGET_PRODUCTS = String(targetCount);

    console.log(`\n=== ${group.label}: target +${targetPerGroup} (${beforeCount} -> ${targetCount}) ===`);

    let result = null;
    let pass = 0;

    while (pass < maxPasses) {
      pass += 1;
      console.log(`${group.label}: pass ${pass}/${maxPasses}`);

      result = await syncCjCatalog();

      const currentCount = await getActiveCjParentCount();
      const added = Math.max(currentCount - beforeCount, 0);
      console.log(`${group.label}: ${added}/${targetPerGroup} new active products added.`);

      if (currentCount >= targetCount) break;

      if (!result || Number(result.importedProducts || 0) < 1) {
        console.warn(`${group.label}: no more usable new products were found in this pass.`);
        break;
      }
    }

    const afterCount = await getActiveCjParentCount();
    summary.push({
      group: group.label,
      requested: targetPerGroup,
      added: Math.max(afterCount - beforeCount, 0),
      before: beforeCount,
      after: afterCount,
      targetReached: afterCount >= targetCount,
    });
  }

  const endingCatalogCount = await getActiveCjParentCount();
  const totalAdded = Math.max(endingCatalogCount - startingCatalogCount, 0);

  console.log("\nRotavoy Wave 2 catalog expansion complete.");
  console.table(summary);
  console.log(`Active CJ catalog: ${startingCatalogCount} -> ${endingCatalogCount} (+${totalAdded}).`);

  const incomplete = summary.filter((row) => !row.targetReached);
  if (incomplete.length > 0) {
    console.warn(
      `Groups below target: ${incomplete.map((row) => `${row.group} (${row.added}/${row.requested})`).join(", ")}. CJ did not expose enough new usable products for those searches in this run.`,
    );
  }
} catch (error) {
  console.error("Rotavoy Wave 2 catalog expansion failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
