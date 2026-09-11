import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { syncCjCatalog } from "../services/cjCatalogSync.js";
import {
  enrichPendingProductContent,
  isProductContentAiConfigured,
} from "../services/productContentEnrichment.js";

function shouldEnrichAfterSync() {
  return String(process.env.ROTAVOY_CONTENT_ENRICH_ON_SYNC || "false").toLowerCase() === "true";
}

try {
  await connectDatabase();
  const result = await syncCjCatalog();
  console.log("CJ catalog sync complete:", JSON.stringify(result, null, 2));

  if (shouldEnrichAfterSync()) {
    if (!isProductContentAiConfigured()) {
      console.warn("Rotavoy content enrichment skipped: OPENAI_API_KEY is not configured.");
    } else {
      const enrichment = await enrichPendingProductContent();
      console.log("Rotavoy product content enrichment complete:", JSON.stringify(enrichment, null, 2));
    }
  }
} catch (error) {
  console.error("CJ catalog sync failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
