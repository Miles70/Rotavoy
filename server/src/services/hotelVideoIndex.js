import { HotelVideoIndex } from "../models/HotelVideoIndex.js";
import { getNuiteeHotel, listNuiteeHotels } from "./nuiteeApi.js";

export const DEFAULT_VIDEO_INDEX_TARGETS = [
  { countryCode: "TR", cityName: "Antalya" },
  { countryCode: "TR", cityName: "Belek" },
  { countryCode: "TR", cityName: "Side" },
  { countryCode: "TR", cityName: "Kemer" },
  { countryCode: "TR", cityName: "Alanya" },
  { countryCode: "AE", cityName: "Dubai" },
  { countryCode: "TH", cityName: "Bangkok" },
  { countryCode: "TH", cityName: "Phuket" },
  { countryCode: "ID", cityName: "Bali" },
  { countryCode: "VN", cityName: "Da Nang" },
  { countryCode: "KH", cityName: "Siem Reap" },
  { countryCode: "CO", cityName: "Medellin" },
  { countryCode: "BR", cityName: "Rio de Janeiro" },
  { countryCode: "AU", cityName: "Sydney" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function findHotelVideoUrl(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return /^https?:\/\//i.test(value) && /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(value)
      ? value
      : "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findHotelVideoUrl(item);
      if (found) return found;
    }
    return "";
  }

  if (typeof value !== "object") return "";

  for (const [key, nested] of Object.entries(value)) {
    if (/video/i.test(key) && typeof nested === "string" && /^https?:\/\//i.test(nested)) {
      return nested;
    }
  }

  for (const nested of Object.values(value)) {
    const found = findHotelVideoUrl(nested);
    if (found) return found;
  }

  return "";
}

function unwrapHotel(payload) {
  return payload?.data?.hotel || payload?.data || payload?.hotel || payload || {};
}

function numericStars(hotel) {
  const raw =
    hotel?.stars ??
    hotel?.starRating ??
    hotel?.ratingStars ??
    hotel?.category ??
    0;
  const parsed = Number.parseFloat(String(raw).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function hotelPhoto(hotel) {
  return String(
    hotel?.main_photo ||
      hotel?.mainPhoto ||
      hotel?.thumbnail ||
      hotel?.image ||
      "",
  ).trim();
}

export async function listIndexedVideoHotels(limit = 40) {
  return HotelVideoIndex.find({
    hasVideo: true,
    videoUrl: { $ne: "" },
    stars: { $gte: 5 },
  })
    .sort({ checkedAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 40, 1), 100))
    .lean();
}

export async function indexHotelVideos({
  targets = DEFAULT_VIDEO_INDEX_TARGETS,
  maxChecks = 24,
  delayMs = 2500,
  staleAfterDays = 30,
} = {}) {
  const max = Math.min(Math.max(Number(maxChecks) || 24, 1), 200);
  const delay = Math.max(Number(delayMs) || 2500, 1000);
  const staleBefore = new Date(Date.now() - staleAfterDays * 24 * 60 * 60 * 1000);

  let checked = 0;
  let videosFound = 0;
  let skippedFresh = 0;
  let stoppedByRateLimit = false;

  for (const target of targets) {
    if (checked >= max || stoppedByRateLimit) break;

    let catalog;
    try {
      catalog = await listNuiteeHotels({
        countryCode: target.countryCode,
        cityName: target.cityName,
        limit: 100,
        offset: 0,
      });
    } catch (error) {
      if (error?.statusCode === 429) {
        stoppedByRateLimit = true;
        break;
      }
      continue;
    }

    const hotelIds = Array.isArray(catalog?.hotelIds) ? catalog.hotelIds : [];

    for (const hotelId of hotelIds) {
      if (checked >= max || stoppedByRateLimit) break;

      const fresh = await HotelVideoIndex.exists({
        hotelId,
        checkedAt: { $gte: staleBefore },
      });

      if (fresh) {
        skippedFresh += 1;
        continue;
      }

      try {
        const payload = await getNuiteeHotel(hotelId);
        const hotel = unwrapHotel(payload);
        const videoUrl = findHotelVideoUrl(payload);
        const stars = numericStars(hotel);

        await HotelVideoIndex.findOneAndUpdate(
          { hotelId },
          {
            $set: {
              hotelId,
              name: String(hotel?.name || hotel?.hotelName || "").trim(),
              cityName: String(hotel?.city || hotel?.cityName || target.cityName).trim(),
              countryCode: String(hotel?.countryCode || target.countryCode).toUpperCase(),
              stars,
              mainPhoto: hotelPhoto(hotel),
              videoUrl,
              hasVideo: Boolean(videoUrl),
              checkedAt: new Date(),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        checked += 1;
        if (videoUrl && stars >= 5) videosFound += 1;
      } catch (error) {
        if (error?.statusCode === 429) {
          stoppedByRateLimit = true;
          break;
        }
        checked += 1;
      }

      if (checked < max) {
        await sleep(delay);
      }
    }
  }

  const indexedFiveStarVideos = await HotelVideoIndex.countDocuments({
    hasVideo: true,
    videoUrl: { $ne: "" },
    stars: { $gte: 5 },
  });

  return {
    checked,
    videosFound,
    skippedFresh,
    stoppedByRateLimit,
    indexedFiveStarVideos,
  };
}
