import "dotenv/config";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";

const CHECKPOINT = path.resolve(process.cwd(), ".rotavoy-cj-stock-harvest.json");
const COUNTRY = String(process.env.ROTAVOY_CJ_HARVEST_COUNTRY || "CN").toUpperCase();
const MAX_CYCLES = Math.max(1, Number.parseInt(process.env.ROTAVOY_CJ_GROW_CYCLES || "1000", 10) || 1000);
const API_POINTS_EXIT_CODE = 75;
const WINDOWS_FAST_FAIL_EXIT_CODES = new Set([3221226505, -1073740791]);
const TRANSIENT_CRASH_RETRIES = Math.max(
  0,
  Number.parseInt(process.env.ROTAVOY_CJ_TRANSIENT_CRASH_RETRIES || "3", 10) || 0,
);
const TRANSIENT_CRASH_RETRY_DELAY_MS = Math.max(
  250,
  Number.parseInt(process.env.ROTAVOY_CJ_TRANSIENT_CRASH_RETRY_DELAY_MS || "2000", 10) || 2000,
);
const scripts = [
  "harvestCjStockCatalog.js",
  "auditCjCandidates.js",
  "importCjCandidates.js",
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runScriptOnce(name) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve("src/scripts", name)], {
      stdio: "inherit",
      env: process.env,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function runScript(name) {
  for (let attempt = 0; attempt <= TRANSIENT_CRASH_RETRIES; attempt += 1) {
    const { code, signal } = await runScriptOnce(name);

    if (code === 0) return "completed";

    if (name === "importCjCandidates.js" && code === API_POINTS_EXIT_CODE) {
      return "api_points_exhausted";
    }

    const isTransientWindowsCrash =
      !signal && WINDOWS_FAST_FAIL_EXIT_CODES.has(Number(code));

    if (isTransientWindowsCrash && attempt < TRANSIENT_CRASH_RETRIES) {
      const retryNumber = attempt + 1;
      console.warn(
        `${name} hit Windows fast-fail exit ${code}; retrying automatically ` +
        `(${retryNumber}/${TRANSIENT_CRASH_RETRIES}) after ${TRANSIENT_CRASH_RETRY_DELAY_MS}ms.`,
      );
      await delay(TRANSIENT_CRASH_RETRY_DELAY_MS);
      continue;
    }

    throw new Error(
      `${name} stopped (${signal || code}). Resume with the same command.`,
    );
  }

  throw new Error(`${name} exhausted its transient crash retries.`);
}

async function checkpoint() {
  try { return JSON.parse(await readFile(CHECKPOINT, "utf8")); }
  catch { return {}; }
}

try {
  console.log("Growing CJ catalog in resumable discovery/audit/import batches. Ctrl+C stops the run.");

  catalogCycles:
  for (let cycle = 1; cycle <= MAX_CYCLES; cycle += 1) {
    const before = await checkpoint();
    console.log(`\n=== CJ catalog cycle ${cycle}: ${before.completedCategoryIds?.length || 0} categories complete ===`);
    for (const name of scripts) {
      const result = await runScript(name);
      if (result === "api_points_exhausted") {
        console.log("CJ catalog growth stopped cleanly because today's API points are exhausted. Resume later with the same command.");
        break catalogCycles;
      }
    }

    await connectDatabase();
    const collection = mongoose.connection.collection("cj_stock_candidates");
    const pendingAudit = await collection.countDocuments({
      countryCode: COUNTRY, status: "candidate", "audit.version": { $ne: 2 },
    });
    const pendingImport = await collection.countDocuments({
      countryCode: COUNTRY, status: "candidate",
      "audit.version": 2, "audit.pricedInStockVariants": { $gt: 0 },
      "audit.imageUrl": { $regex: "^https?://" },
    });
    await disconnectDatabase();
    const after = await checkpoint();
    console.log(`Progress: ${after.completedCategoryIds?.length || 0} categories; pending audit ${pendingAudit}; importable candidates ${pendingImport}.`);
    if (after.completed && pendingAudit === 0 && pendingImport === 0) {
      console.log("CJ discovery and import queue complete; review held/failed candidates separately.");
      break;
    }
    if (JSON.stringify(before) === JSON.stringify(after) && pendingAudit === 0 && pendingImport === 0) {
      throw new Error("No progress in this cycle; inspect the harvest checkpoint and candidate report.");
    }
  }
} catch (error) {
  console.error("CJ catalog growth paused:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
