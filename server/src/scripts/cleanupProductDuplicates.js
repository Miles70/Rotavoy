import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { archiveExactCjDuplicates } from "../services/catalogDuplicateCleanup.js";

const apply = process.argv.includes("--apply");

try {
  await connectDatabase();
  const report = await archiveExactCjDuplicates({ apply });
  console.log("Rotavoy exact duplicate cleanup report:");
  console.log(JSON.stringify(report, null, 2));
  if (!apply) {
    console.log("Dry run only. No products were changed.");
  }
} catch (error) {
  console.error("Exact duplicate cleanup failed:", error);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) await disconnectDatabase();
}
