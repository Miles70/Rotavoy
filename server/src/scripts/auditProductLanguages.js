import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { auditProductLanguageIntegrity } from "../services/productLanguageIntegrity.js";

const repair = process.argv.includes("--repair");

try {
  await connectDatabase();
  const result = await auditProductLanguageIntegrity({ repair });
  console.log(
    `Product language audit complete${repair ? " with repair" : ""}:`,
    JSON.stringify(result, null, 2),
  );
} catch (error) {
  console.error("Product language audit failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
