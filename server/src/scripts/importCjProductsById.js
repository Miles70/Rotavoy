import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { syncCjProductsByIds } from "../services/cjCatalogSync.js";

function parseProductIds(args) {
  const values = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = String(args[index] || "").trim();

    if (arg === "--pid" || arg === "--pids") {
      const next = String(args[index + 1] || "").trim();
      if (next) {
        values.push(next);
        index += 1;
      }
      continue;
    }

    if (arg.startsWith("--pid=")) {
      values.push(arg.slice("--pid=".length));
      continue;
    }

    if (arg.startsWith("--pids=")) {
      values.push(arg.slice("--pids=".length));
    }
  }

  return [...new Set(
    values
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean),
  )];
}

const productIds = parseProductIds(process.argv.slice(2));

if (productIds.length === 0) {
  console.error(
    "No CJ product IDs supplied. Example: npm run cj:import -- --pid=PID1,PID2",
  );
  process.exitCode = 1;
} else {
  try {
    await connectDatabase();
    const result = await syncCjProductsByIds(productIds);
    console.log("CJ exact product import complete:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("CJ exact product import failed:", error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}
