import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { Product } from "../models/Product.js";

const COUNTRY = String(process.env.ROTAVOY_CJ_HARVEST_COUNTRY || "CN").toUpperCase();
const LIMIT = Math.min(100, Math.max(1, Number(process.env.ROTAVOY_CJ_IMPORT_BATCH || 10) || 10));
const API_POINTS_EXIT_CODE = 75;
const API_POINTS_ERROR = /insufficient api points/i;
process.env.CJ_REPLACE_LEGACY_CATALOG = "false";
process.env.ROTAVOY_CONTENT_ENRICH_ON_SYNC = "false";
const { syncCjProductsByIds } = await import("../services/cjCatalogSync.js");

function isApiPointsExhausted(error) {
  return API_POINTS_ERROR.test(String(error || ""));
}

try {
  await connectDatabase();
  const collection = mongoose.connection.collection("cj_stock_candidates");

  const recovered = await collection.updateMany(
    {
      countryCode: COUNTRY,
      status: "import_failed",
      importError: API_POINTS_ERROR,
    },
    {
      $set: { status: "candidate" },
      $unset: { importError: "" },
    },
  );
  if (recovered.modifiedCount > 0) {
    console.log(`Recovered ${recovered.modifiedCount} candidates previously blocked only by exhausted CJ API points.`);
  }

  const batch = await collection.find({
    countryCode: COUNTRY, status: "candidate",
    "audit.version": 2,
    "audit.pricedInStockVariants": { $gt: 0 },
    "audit.imageUrl": { $regex: "^https?://" },
    "audit.decision": "manual_review_required",
  }).sort({ listedNum: -1, firstSeenAt: 1 }).limit(LIMIT).toArray();
  console.log(`Importing up to ${batch.length} audited CJ products. Existing catalog products are preserved.`);
  let imported = 0;
  let skipped = 0;
  let apiPointsExhausted = false;
  for (const candidate of batch) {
    if (await Product.exists({ source: "cj", supplierProductId: candidate.pid })) {
      await collection.updateOne({ _id: candidate._id }, { $set: { status: "existing_product" } });
      skipped += 1;
      continue;
    }
    const result = await syncCjProductsByIds([candidate.pid]);
    const item = result.results?.[0];
    if (item?.status !== "imported" || !item.activeVariants) {
      const importError = String(item?.error || "no active variants imported");
      if (isApiPointsExhausted(importError)) {
        console.warn(`${candidate.pid}: CJ daily API points exhausted; candidate retained for the next run.`);
        apiPointsExhausted = true;
        break;
      }
      console.warn(`${candidate.pid}: ${importError}; held for review.`);
      if (/too many requests|qps limit|rate limit/i.test(importError)) break;
      await collection.updateOne({ _id: candidate._id }, { $set: {
        status: "import_failed",
        importError: importError.slice(0, 300),
      } });
      continue;
    }
    const activeWithImage = await Product.exists({
      source: "cj", supplierProductId: candidate.pid,
      isActive: true, stock: { $gt: 0 }, imageUrl: { $regex: "^https?://" },
    });
    if (!activeWithImage) {
      await Product.updateMany(
        { source: "cj", supplierProductId: candidate.pid },
        { $set: { isActive: false } },
      );
      console.warn(`${candidate.pid}: imported without a usable image; kept off the storefront.`);
      await collection.updateOne({ _id: candidate._id }, { $set: {
        status: "import_failed", importError: "No active variant with an image",
      } });
      continue;
    }
    await collection.updateOne({ _id: candidate._id }, {
      $set: { status: "imported", importedAt: new Date(), importedVariants: item.activeVariants },
    });
    imported += 1;
    console.log(`${candidate.pid}: imported ${item.activeVariants} stocked variants.`);
  }
  console.log(`Imported ${imported} product parents; ${skipped} already existed.`);
  if (apiPointsExhausted) {
    console.log("CJ daily API points are exhausted. Catalog growth paused safely; run the same command after the points reset.");
    process.exitCode = API_POINTS_EXIT_CODE;
  } else {
    console.log("Run again for the next batch.");
  }
} catch (error) {
  console.error("Candidate import stopped:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
