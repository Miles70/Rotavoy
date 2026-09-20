import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";

const MB = 1024 * 1024;

function mb(value) {
  return (Number(value || 0) / MB).toFixed(2);
}

async function collectionStats(db, name) {
  try {
    const stats = await db.command({ collStats: name });
    return {
      name,
      count: Number(stats.count || 0),
      size: Number(stats.size || 0),
      storageSize: Number(stats.storageSize || 0),
      totalIndexSize: Number(stats.totalIndexSize || 0),
      avgObjSize: Number(stats.avgObjSize || 0),
    };
  } catch (error) {
    return { name, error: String(error?.message || error) };
  }
}

try {
  await connectDatabase();
  const db = mongoose.connection.db;
  const dbStats = await db.command({ dbStats: 1 });
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const rows = [];

  for (const { name } of collections) {
    if (name.startsWith("system.")) continue;
    rows.push(await collectionStats(db, name));
  }

  rows.sort((a, b) => (
    (Number(b.storageSize || 0) + Number(b.totalIndexSize || 0)) -
    (Number(a.storageSize || 0) + Number(a.totalIndexSize || 0))
  ));

  console.log("\n=== MongoDB storage report (read-only) ===");
  console.log(`Database: ${db.databaseName}`);
  console.log(`Logical data size: ${mb(dbStats.dataSize)} MB`);
  console.log(`Storage size: ${mb(dbStats.storageSize)} MB`);
  console.log(`Index size: ${mb(dbStats.indexSize)} MB`);
  console.log(`Collections: ${dbStats.collections || rows.length}`);
  console.log(`Objects: ${dbStats.objects || 0}`);

  console.log("\nPer collection:");
  for (const row of rows) {
    if (row.error) {
      console.log(`- ${row.name}: stats unavailable (${row.error})`);
      continue;
    }
    console.log(
      `- ${row.name}: docs ${row.count.toLocaleString("en-US")}, logical ${mb(row.size)} MB, storage ${mb(row.storageSize)} MB, indexes ${mb(row.totalIndexSize)} MB, avg doc ${(row.avgObjSize / 1024).toFixed(2)} KB`,
    );
  }

  const products = db.collection("products");
  const productDocs = await products.countDocuments({});
  if (productDocs > 0) {
    const cjVariantDocs = await products.countDocuments({ source: "cj" });
    const cjParentIds = await products.distinct("supplierProductId", {
      source: "cj",
      supplierProductId: { $nin: ["", null] },
    });
    const activeCjDocs = await products.countDocuments({ source: "cj", isActive: true });
    console.log("\nCJ product shape:");
    console.log(`- Product documents: ${productDocs.toLocaleString("en-US")}`);
    console.log(`- CJ variant documents: ${cjVariantDocs.toLocaleString("en-US")}`);
    console.log(`- CJ parent products: ${cjParentIds.length.toLocaleString("en-US")}`);
    console.log(`- Active CJ variant documents: ${activeCjDocs.toLocaleString("en-US")}`);
    if (cjParentIds.length) {
      console.log(`- Average CJ variants per parent: ${(cjVariantDocs / cjParentIds.length).toFixed(2)}`);
    }
  }

  const candidateExists = collections.some(({ name }) => name === "cj_stock_candidates");
  if (candidateExists) {
    const statuses = await db.collection("cj_stock_candidates").aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();
    console.log("\nCJ candidate queue:");
    for (const row of statuses) {
      console.log(`- ${row._id || "(missing status)"}: ${Number(row.count || 0).toLocaleString("en-US")}`);
    }
  }

  console.log("\nNo data was changed.");
} catch (error) {
  console.error("Storage report failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
