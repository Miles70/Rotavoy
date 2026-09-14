import "dotenv/config";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { cleanCatalogQuality } from "./services/catalogQualityCleanup.js";
import { migrateLegacyOrderNumbers } from "./services/orderNumberMigration.js";
import { syncProductsFromCatalog } from "./services/productSync.js";
import { releaseExpiredOrderReservations } from "./services/stockReservation.js";
import {
  getCjAvailabilityInitialDelayMs,
  getCjAvailabilityIntervalMs,
  syncCjAvailability,
} from "./services/cjAvailabilitySync.js";

const port = Number(process.env.PORT) || 5000;
const app = createApp();
let server;
let reservationSweepTimer;
let cjAvailabilityInitialTimer;
let cjAvailabilityTimer;

function getReservationSweepMs() {
  const parsed = Number.parseInt(process.env.ORDER_RESERVATION_SWEEP_MS, 10);

  if (!Number.isInteger(parsed) || parsed < 10_000) {
    return 60_000;
  }

  return parsed;
}

async function sweepExpiredReservations() {
  try {
    const result = await releaseExpiredOrderReservations();

    if (result.releasedCount > 0) {
      console.log(
        `Expired order reservations released: ${result.releasedCount}.`
      );
    }
  } catch (error) {
    console.error("Expired order reservation cleanup failed:", error);
  }
}

async function refreshCjAvailability() {
  try {
    const result = await syncCjAvailability();
    if (result.skipped) return;

    console.log(
      `CJ availability refreshed: ${result.checkedProducts}/${result.catalogProducts} products, ${result.updatedVariants} variants updated, ${result.deactivatedVariants} unavailable.`,
    );

    if (result.failedProducts > 0) {
      console.warn(`CJ availability refresh failed for ${result.failedProducts} products.`);
    }
  } catch (error) {
    console.error("CJ availability refresh failed:", error);
  }
}

async function startServer() {
  await connectDatabase();

  const orderMigrationResult = await migrateLegacyOrderNumbers();

  if (orderMigrationResult.modifiedCount > 0) {
    console.log(
      `Legacy order numbers migrated: ${orderMigrationResult.modifiedCount} KMR/GBL/MTR orders changed to RTV.`,
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

  await sweepExpiredReservations();

  server = app.listen(port, () => {
    console.log(`Rotavoy API running on http://localhost:${port}`);
  });

  reservationSweepTimer = setInterval(
    sweepExpiredReservations,
    getReservationSweepMs()
  );
  reservationSweepTimer.unref?.();

  cjAvailabilityInitialTimer = setTimeout(
    refreshCjAvailability,
    getCjAvailabilityInitialDelayMs(),
  );
  cjAvailabilityInitialTimer.unref?.();

  cjAvailabilityTimer = setInterval(
    refreshCjAvailability,
    getCjAvailabilityIntervalMs(),
  );
  cjAvailabilityTimer.unref?.();
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  if (reservationSweepTimer) {
    clearInterval(reservationSweepTimer);
  }

  if (cjAvailabilityInitialTimer) {
    clearTimeout(cjAvailabilityInitialTimer);
  }

  if (cjAvailabilityTimer) {
    clearInterval(cjAvailabilityTimer);
  }

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
