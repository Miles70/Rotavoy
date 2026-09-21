import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";

try {
  await connectDatabase();
  const candidates = mongoose.connection.collection("cj_stock_candidates");
  const countryCode = String(process.env.ROTAVOY_CJ_HARVEST_COUNTRY || "CN").toUpperCase();
  const match = { countryCode, status: "candidate" };
  const count = await candidates.countDocuments(match);
  const departments = await candidates.aggregate([
    { $match: match },
    { $group: { _id: "$categoryLabel", count: { $sum: 1 }, maxListed: { $max: "$listedNum" } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]).toArray();
  const sample = await candidates.find(match, { projection: { _id: 0, pid: 1, title: 1, categoryLabel: 1, listedNum: 1 } })
    .sort({ listedNum: -1 }).limit(20).toArray();
  const audited = await candidates.find(
    { ...match, "audit.checkedAt": { $exists: true } },
    { projection: { _id: 0, pid: 1, title: 1, listedNum: 1, "audit.pricedInStockVariants": 1, "audit.sampledCostUsd": 1, "audit.shipping": 1, "audit.flags": 1, "audit.decision": 1 } },
  ).sort({ listedNum: -1 }).limit(100).toArray();
  const auditErrors = await candidates.countDocuments({ ...match, auditError: { $exists: true }, "audit.checkedAt": { $exists: false } });
  const imported = await candidates.countDocuments({ countryCode, status: "imported" });
  const heldMatch = { countryCode, status: { $in: ["possible_duplicate", "import_failed"] } };
  const held = await candidates.countDocuments(heldMatch);
  const heldByStatus = await candidates.aggregate([
    { $match: heldMatch },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();
  const heldFailures = await candidates.find(
    { countryCode, status: "import_failed" },
    {
      projection: {
        _id: 0,
        pid: 1,
        title: 1,
        importError: 1,
        "retry.importAttempts": 1,
        "retry.lastImportError": 1,
        "audit.flags": 1,
      },
    },
  ).sort({ listedNum: -1, firstSeenAt: 1 }).limit(50).toArray();
  const possibleDuplicates = await candidates.find(
    { countryCode, status: "possible_duplicate" },
    { projection: { _id: 0, pid: 1, title: 1, categoryLabel: 1, listedNum: 1 } },
  ).sort({ listedNum: -1, firstSeenAt: 1 }).limit(50).toArray();

  console.log(JSON.stringify({
    count,
    imported,
    held,
    heldByStatus,
    heldFailures,
    possibleDuplicates,
    departments,
    topListingSignals: sample,
    audited,
    auditErrors,
  }, null, 2));
  console.log("listedNum is a CJ listing signal; it does not establish sales or shipping demand.");
} catch (error) {
  console.error("Candidate report failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
