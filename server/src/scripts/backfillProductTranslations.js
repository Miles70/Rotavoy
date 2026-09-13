import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { backfillMissingProductTranslations } from "../services/productTranslationBackfill.js";

function getCliLimit() {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  return argument ? argument.slice("--limit=".length) : undefined;
}

try {
  process.env.CJ_TRANSLATE_PRODUCTS = "true";
  await connectDatabase();
  const result = await backfillMissingProductTranslations({ limit: getCliLimit() });
  console.log("Rotavoy product translation backfill complete:", JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Rotavoy product translation backfill failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
