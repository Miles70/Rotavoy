import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";

try {
  await connectDatabase();
  const candidates = mongoose.connection.collection("cj_stock_candidates");
  const match = { countryCode: String(process.env.ROTAVOY_CJ_HARVEST_COUNTRY || "CN").toUpperCase(), status: "candidate" };
  const count = await candidates.countDocuments(match);
  const departments = await candidates.aggregate([
    { $match: match },
    { $group: { _id: "$categoryLabel", count: { $sum: 1 }, maxListed: { $max: "$listedNum" } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]).toArray();
  const sample = await candidates.find(match, { projection: { _id: 0, pid: 1, title: 1, categoryLabel: 1, listedNum: 1 } })
    .sort({ listedNum: -1 }).limit(20).toArray();
  console.log(JSON.stringify({ count, departments, topListingSignals: sample }, null, 2));
  console.log("listedNum is a CJ listing signal; it does not establish sales or shipping demand.");
} catch (error) {
  console.error("Candidate report failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
