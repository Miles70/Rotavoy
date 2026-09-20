import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";

try {
  await connectDatabase();
  const collection = mongoose.connection.db.collection("products");
  const indexes = await collection.indexes();
  const textIndexes = indexes.filter((index) =>
    Object.values(index.key || {}).some((value) => value === "text")
  );

  if (!textIndexes.length) {
    console.log("No text index found on products. Nothing to remove.");
  } else {
    for (const index of textIndexes) {
      console.log(`Dropping unused products text index: ${index.name}`);
      await collection.dropIndex(index.name);
    }
    console.log(`Removed ${textIndexes.length} unused products text index(es).`);
  }
} catch (error) {
  console.error("Unused text index cleanup failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
