import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { Product } from "../models/Product.js";
import { classifyCatalogCategory } from "../services/catalogCategory.js";

const APPLY = process.argv.includes("--apply");
const SAMPLE_LIMIT = 6;
const BULK_BATCH_SIZE = 300;

function sourceCategoryLabel(row) {
  return String(
    row?.supplierCategoryLabel ||
    row?.fallbackCategoryLabel ||
    "",
  ).trim();
}

function sourceTitle(row) {
  return String(
    row?.supplierTitle ||
    row?.fallbackTitle ||
    "",
  ).trim();
}

async function applyChanges(changes) {
  for (let offset = 0; offset < changes.length; offset += BULK_BATCH_SIZE) {
    const batch = changes.slice(offset, offset + BULK_BATCH_SIZE);
    await Product.bulkWrite(
      batch.map((change) => ({
        updateMany: {
          filter: {
            source: "cj",
            supplierProductId: change.supplierProductId,
          },
          update: {
            $set: { categoryKey: change.nextCategory },
          },
        },
      })),
      { ordered: false },
    );
  }
}

try {
  await connectDatabase();

  const parents = await Product.aggregate([
    {
      $match: {
        source: "cj",
        supplierProductId: { $nin: ["", null] },
      },
    },
    { $sort: { supplierProductId: 1, createdAt: 1, key: 1 } },
    {
      $group: {
        _id: "$supplierProductId",
        currentCategory: { $first: "$categoryKey" },
        supplierCategoryLabel: { $first: "$supplierContent.categoryLabel" },
        supplierTitle: { $first: "$supplierContent.title" },
        fallbackCategoryLabel: { $first: "$categoryLabel" },
        fallbackTitle: { $first: "$title" },
        variants: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).allowDiskUse(true);

  const changes = [];
  const transitionCounts = new Map();
  const samples = new Map();

  for (const parent of parents) {
    const currentCategory = String(parent.currentCategory || "").trim();
    const categoryLabel = sourceCategoryLabel(parent);
    const title = sourceTitle(parent);
    const nextCategory = classifyCatalogCategory({ categoryLabel, title });

    if (!nextCategory || nextCategory === currentCategory) continue;

    const transition = `${currentCategory || "(empty)"} -> ${nextCategory}`;
    transitionCounts.set(transition, (transitionCounts.get(transition) || 0) + 1);

    if (!samples.has(transition)) samples.set(transition, []);
    const transitionSamples = samples.get(transition);
    if (transitionSamples.length < SAMPLE_LIMIT) {
      transitionSamples.push({
        pid: String(parent._id),
        title,
        categoryLabel,
        variants: Number(parent.variants || 0),
      });
    }

    changes.push({
      supplierProductId: String(parent._id),
      currentCategory,
      nextCategory,
    });
  }

  console.log(`CJ category audit: ${parents.length} parent products checked.`);
  console.log(`${changes.length} parent products would change category.`);

  for (const [transition, count] of [...transitionCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`\n${transition}: ${count} parent products`);
    for (const sample of samples.get(transition) || []) {
      console.log(
        `  - ${sample.pid} | ${sample.title || "(untitled)"} | supplier category: ${sample.categoryLabel || "(none)"} | variants: ${sample.variants}`,
      );
    }
  }

  if (!APPLY) {
    console.log("\nDry run only. No products were changed.");
    console.log("Run with --apply after reviewing this report.");
  } else if (!changes.length) {
    console.log("\nNo category changes were necessary.");
  } else {
    await applyChanges(changes);
    console.log(`\nApplied category corrections to ${changes.length} CJ parent products and all of their stored variants.`);
  }
} catch (error) {
  console.error("CJ category reclassification failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
