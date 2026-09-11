import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { syncCjCatalog } from "../services/cjCatalogSync.js";

try {
  await connectDatabase();
  const result = await syncCjCatalog();
  console.log("CJ catalog sync complete:", JSON.stringify(result, null, 2));
} catch (error) {
  console.error("CJ catalog sync failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
