import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { importAmazonCatalog } from "../services/amazonCatalogImport.js";

try {
  await connectDatabase();

  const result = await importAmazonCatalog();

  console.log("Amazon catalog import complete:");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Amazon catalog import failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
