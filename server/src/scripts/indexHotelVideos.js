import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import {
  DEFAULT_VIDEO_INDEX_TARGETS,
  indexHotelVideos,
} from "../services/hotelVideoIndex.js";

function readNumberArg(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) return fallback;
  const value = Number(match.slice(prefix.length));
  return Number.isFinite(value) ? value : fallback;
}

function readTargets() {
  const prefix = "--targets=";
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) return DEFAULT_VIDEO_INDEX_TARGETS;

  return match
    .slice(prefix.length)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [countryCode, ...cityParts] = entry.split(":");
      return {
        countryCode: String(countryCode || "").trim().toUpperCase(),
        cityName: cityParts.join(":").trim(),
      };
    })
    .filter((target) => /^[A-Z]{2}$/.test(target.countryCode) && target.cityName);
}

async function main() {
  await connectDatabase();

  try {
    const result = await indexHotelVideos({
      targets: readTargets(),
      maxChecks: readNumberArg("max", 24),
      delayMs: readNumberArg("delay", 2500),
      staleAfterDays: readNumberArg("stale-days", 30),
    });

    console.log("Hotel video index complete:", result);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error("Hotel video index failed:", error);
  process.exitCode = 1;
});
