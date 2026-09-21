import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";

const COUNTRY = String(process.env.ROTAVOY_CJ_HARVEST_COUNTRY || "CN").toUpperCase();
const MAX_RETRIES = Math.max(
  1,
  Number.parseInt(process.env.ROTAVOY_CJ_HELD_RETRY_LIMIT || "3", 10) || 3,
);
const RETRYABLE_IMPORT_ERROR =
  /timeout|timed out|fetch failed|econnreset|network|temporar|system busy|too many requests|qps limit|rate limit|insufficient api points/i;

try {
  await connectDatabase();
  const collection = mongoose.connection.collection("cj_stock_candidates");

  const failed = await collection.find(
    {
      countryCode: COUNTRY,
      status: "import_failed",
      "audit.version": 2,
      "audit.pricedInStockVariants": { $gt: 0 },
      "audit.imageUrl": { $regex: "^https?://" },
    },
    {
      projection: {
        pid: 1,
        importError: 1,
        "retry.importAttempts": 1,
      },
    },
  ).toArray();

  const retryable = failed.filter((candidate) => (
    RETRYABLE_IMPORT_ERROR.test(String(candidate.importError || "")) &&
    Number(candidate.retry?.importAttempts || 0) < MAX_RETRIES
  ));

  if (retryable.length) {
    const now = new Date();
    await collection.bulkWrite(
      retryable.map((candidate) => ({
        updateOne: {
          filter: { _id: candidate._id, status: "import_failed" },
          update: {
            $set: {
              status: "candidate",
              "retry.lastImportError": String(candidate.importError || "").slice(0, 300),
              "retry.lastQueuedAt": now,
            },
            $inc: { "retry.importAttempts": 1 },
            $unset: { importError: "" },
          },
        },
      })),
      { ordered: false },
    );
  }

  const retryLimitReached = failed.filter((candidate) => (
    RETRYABLE_IMPORT_ERROR.test(String(candidate.importError || "")) &&
    Number(candidate.retry?.importAttempts || 0) >= MAX_RETRIES
  )).length;
  const nonRetryable = failed.filter((candidate) => (
    !RETRYABLE_IMPORT_ERROR.test(String(candidate.importError || ""))
  )).length;
  const possibleDuplicates = await collection.countDocuments({
    countryCode: COUNTRY,
    status: "possible_duplicate",
  });

  console.log(
    `Held CJ cleanup: requeued ${retryable.length} transient import failures; ` +
    `${retryLimitReached} reached the retry limit; ${nonRetryable} non-transient failures remain held.`,
  );
  console.log(
    `Possible duplicates still held for manual review: ${possibleDuplicates}. They are not auto-imported.`,
  );

  if (!retryable.length) {
    console.log("No retryable held imports remain.");
  }
} catch (error) {
  console.error("Held CJ retry preparation failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
