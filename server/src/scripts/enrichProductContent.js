import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { enrichPendingProductContent } from "../services/productContentEnrichment.js";

function getCliLimit() {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  if (!argument) return undefined;
  return argument.slice("--limit=".length);
}

try {
  await connectDatabase();
  const result = await enrichPendingProductContent({ limit: getCliLimit() });
  console.log("Rotavoy product content enrichment complete:", JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Rotavoy product content enrichment failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
