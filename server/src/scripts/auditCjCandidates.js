import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { Product } from "../models/Product.js";
import { buildCjVariantStockMap } from "../services/cjCatalogSync.js";
import {
  calculateCjFreight,
  getCjProductDetail,
  getCjProductInventory,
} from "../services/cjApi.js";

const COUNTRY = String(process.env.ROTAVOY_CJ_HARVEST_COUNTRY || "CN").toUpperCase();
const DESTINATIONS = ["US", "GB", "DE", "TR"];
const LIMIT = Math.min(100, Math.max(1, Number(process.env.ROTAVOY_CJ_AUDIT_LIMIT || 20) || 20));

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function retry(task) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await task(); }
    catch (error) {
      const transient = [429, 502, 503, 504].includes(Number(error?.statusCode)) ||
        /too many requests|qps limit|timeout|temporar|system busy|fetch failed/i.test(String(error?.message || ""));
      if (!transient || attempt >= 3) throw error;
      await sleep(Math.min(15_000 * 2 ** attempt, 60_000));
    }
  }
}

function validImage(url) {
  try { return ["https:", "http:"].includes(new URL(String(url || "")).protocol); }
  catch { return false; }
}

async function audit(candidate) {
  // Recheck against the live catalog because products may have arrived after discovery.
  if (await Product.exists({ source: "cj", supplierProductId: candidate.pid })) {
    return { status: "existing_product", audit: { checkedAt: new Date(), reason: "already in Rotavoy" } };
  }
  const detail = await retry(() => getCjProductDetail(candidate.pid));
  const inventory = await retry(() => getCjProductInventory(candidate.pid));
  const variants = Array.isArray(detail?.variants) ? detail.variants : [];
  const stockMap = buildCjVariantStockMap(inventory, COUNTRY);
  const viable = variants.filter((variant) =>
    String(variant?.vid || "").trim() &&
    Number(variant?.variantSellPrice) > 0 &&
    Number(stockMap.get(String(variant.vid)) || 0) > 0
  );
  const flags = [];
  const title = String(detail?.productNameEn || detail?.nameEn || "").trim();
  const imageUrl = detail?.productImage || detail?.bigImage || candidate.imageUrl;
  if (!title) flags.push("missing_title");
  if (!validImage(imageUrl)) flags.push("missing_image");
  if (!variants.length) flags.push("missing_variants");
  if (!stockMap.size) flags.push("inventory_unverified");
  if (!viable.length) flags.push("no_priced_in_stock_variant");
  if (candidate.categoryLabel && title) flags.push("category_and_title_require_manual_review");

  const shipping = {};
  if (viable.length) {
    for (const country of DESTINATIONS) {
      try {
        const rows = await retry(() => calculateCjFreight({
          endCountryCode: country,
          startCountryCode: COUNTRY,
          products: [{ vid: String(viable[0].vid), quantity: 1 }],
        }));
        shipping[country] = Array.isArray(rows) && rows.length ? "methods_returned" : "no_methods_returned";
      } catch (error) {
        // A country-wide query lacks the buyer's postal code. Failure is unknown,
        // not proof that CJ cannot ship to that destination.
        shipping[country] = "unknown";
        flags.push(`shipping_query_failed_${country}`);
        if ([401, 429, 503].includes(Number(error?.statusCode))) throw error;
      }
    }
  }
  return {
    status: "candidate",
    audit: {
      checkedAt: new Date(), title, imageUrl: String(imageUrl || "").slice(0, 2048),
      variants: variants.length, pricedInStockVariants: viable.length,
      sampledVariantId: viable[0]?.vid || "",
      sampledVariantStock: viable.length ? Number(stockMap.get(String(viable[0].vid))) : 0,
      sampledCostUsd: viable.length ? Number(viable[0].variantSellPrice) : null,
      shipping, flags, decision: "manual_review_required",
    },
  };
}

try {
  await connectDatabase();
  const collection = mongoose.connection.collection("cj_stock_candidates");
  const candidates = await collection.find({
    countryCode: COUNTRY, status: "candidate", "audit.checkedAt": { $exists: false },
  }).sort({ listedNum: -1, firstSeenAt: 1 }).limit(LIMIT).toArray();
  console.log(`Auditing ${candidates.length} candidates; storefront remains unchanged.`);
  for (const candidate of candidates) {
    try {
      const result = await audit(candidate);
      await collection.updateOne({ _id: candidate._id }, { $set: result });
      console.log(`${candidate.pid}: ${result.status}, stocked variants ${result.audit.pricedInStockVariants ?? 0}, flags ${(result.audit.flags || []).join(",")}`);
    } catch (error) {
      console.error(`${candidate.pid}: audit failed: ${error.message}`);
      if ([401, 429, 503].includes(Number(error?.statusCode))) throw error;
      await collection.updateOne({ _id: candidate._id }, { $set: {
        auditError: { message: String(error.message).slice(0, 300), updatedAt: new Date() },
      } });
    }
  }
  console.log("Audit complete. No candidate was published.");
} catch (error) {
  console.error("Audit stopped; remaining candidates can be retried:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
