import "dotenv/config";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { cleanCatalogQuality } from "./services/catalogQualityCleanup.js";
import { migrateLegacyOrderNumbers } from "./services/orderNumberMigration.js";
import { syncProductsFromCatalog } from "./services/productSync.js";

const port = Number(process.env.PORT) || 5000;
const app = createApp();
let server;

async function startServer() {
  await connectDatabase();

  const orderMigrationResult = await migrateLegacyOrderNumbers();

  if (orderMigrationResult.modifiedCount > 0) {
    console.log(
      `Legacy order numbers migrated: ${orderMigrationResult.modifiedCount} KMR orders changed to MTR.`,
    );
  }

  if (orderMigrationResult.skippedCount > 0) {
    console.warn(
      `Legacy order migration skipped ${orderMigrationResult.skippedCount} duplicate order numbers.`,
    );
  }

  const legacyCleanupResult = await syncProductsFromCatalog();
  if (legacyCleanupResult.deletedCount > 0) {
    console.log(`Legacy demo products removed: ${legacyCleanupResult.deletedCount}.`);
  }

  const qualityCleanupResult = await cleanCatalogQuality();

  if (qualityCleanupResult.skipped) {
    console.warn(
      `Catalog cleanup skipped: only ${qualityCleanupResult.qualityProductCount} verified Amazon products were found.`,
    );
  } else {
    if (qualityCleanupResult.restoredTitleCount > 0) {
      console.log(
        `Amazon product titles restored: ${qualityCleanupResult.restoredTitleCount}.`,
      );
    }

    if (qualityCleanupResult.deletedLowQualityCount > 0) {
      console.log(
        `Low-quality catalog products removed: ${qualityCleanupResult.deletedLowQualityCount}.`,
      );
    }

    console.log(
      `Verified Amazon catalog ready: ${qualityCleanupResult.qualityProductCount} products.`,
    );
  }

  server = app.listen(port, () => {
    console.log(`Masterota API running on http://localhost:${port}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await disconnectDatabase();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer().catch((error) => {
  console.error("Server could not start:", error);
  process.exit(1);
});
