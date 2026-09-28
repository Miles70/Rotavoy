import { HotelVideoIndex } from "../models/HotelVideoIndex.js";
import { getNuiteeHotel, listNuiteeHotels } from "./nuiteeApi.js";

export const DEFAULT_VIDEO_INDEX_TARGETS = [
  { countryCode: "TR", cityName: "Antalya" },
  { countryCode: "AE", cityName: "Dubai" },
  { countryCode: "TH", cityName: "Phuket" },
  { countryCode: "ID", cityName: "Bali" },
  { countryCode: "VN", cityName: "Da Nang" },
  { countryCode: "KH", cityName: "Siem Reap" },
  { countryCode: "BR", cityName: "Rio de Janeiro" },
  { countryCode: "AU", cityName: "Sydney" },
  { countryCode: "CO", cityName: "Medellin" },
  { countryCode: "US", cityName: "Miami" },
  { countryCode: "US", cityName: "Honolulu" },
  { countryCode: "US", cityName: "Las Vegas" },
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

function collectHotelImages(value, result = [], seen = new Set()) {
  if (!value || result.length >= 40) return result;

  if (typeof value === "string") {
    const looksLikeImage =
      /^https?:\/\//i.test(value) &&
      (/\.(jpe?g|png|webp)(\?|$)/i.test(value) ||
        /image|photo|picture|cdn/i.test(value));

    if (looksLikeImage && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectHotelImages(item, result, seen));
    return result;
  }

  if (typeof value === "object") {
    const hdPreferred = [
      "urlHd",
      "urlHD",
      "hdUrl",
      "highResUrl",
      "originalUrl",
      "original",
    ];
    const fallbackPreferred = ["url", "image", "src", "link", "thumbnail"];
    const hdValues = hdPreferred
      .map((key) => value[key])
      .filter((candidate) => typeof candidate === "string" && candidate.trim());

    if (hdValues.length) {
      hdValues.forEach((candidate) =>
        collectHotelImages(candidate, result, seen),
      );
    } else {
      fallbackPreferred.forEach((key) =>
        collectHotelImages(value[key], result, seen),
      );
    }

    const preferred = [...hdPreferred, ...fallbackPreferred];
    Object.entries(value)
      .filter(
        ([key]) =>
          !preferred.includes(key) && /image|photo|picture|gallery/i.test(key),
      )
      .forEach(([, nested]) => collectHotelImages(nested, result, seen));
  }

  return result;
}

function hotelPhoto(hotel) {
  const galleryImages = [];
  const seen = new Set();

  [
    hotel?.images,
    hotel?.photos,
    hotel?.pictures,
    hotel?.gallery,
    hotel?.hotelImages,
    hotel?.hotelPhotos,
    hotel?.media,
  ].forEach((source) => {
    if (Array.isArray(source) && source.length > 1) {
      const preferred = source.filter((item) => item?.defaultImage !== true);
      collectHotelImages(preferred.length ? preferred : source, galleryImages, seen);
      return;
    }

    collectHotelImages(source, galleryImages, seen);
  });

  if (galleryImages.length) return galleryImages[0];

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

export async function listIndexedShowcaseHotels(limit = 80) {
  return HotelVideoIndex.find({
    stars: { $gte: 5 },
  })
    .sort({ hasVideo: -1, checkedAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 80, 1), 120))
    .lean();
}

export async function refreshIndexedShowcasePhotos({
  maxChecks = 30,
  delayMs = 10000,
} = {}) {
  const max = Math.min(Math.max(Number(maxChecks) || 30, 1), 120);
  const delay = Math.max(Number(delayMs) || 10000, 3000);
  const hotels = await HotelVideoIndex.find({ stars: { $gte: 5 } })
    .sort({ checkedAt: -1 })
    .limit(max)
    .lean();

  let checked = 0;
  let updated = 0;
  let stoppedByRateLimit = false;

  for (const indexedHotel of hotels) {
    try {
      const payload = await getNuiteeHotel(indexedHotel.hotelId);
      const hotel = unwrapHotel(payload);
      const mainPhoto = hotelPhoto(hotel);

      if (mainPhoto && mainPhoto !== indexedHotel.mainPhoto) {
        await HotelVideoIndex.updateOne(
          { hotelId: indexedHotel.hotelId },
          { $set: { mainPhoto } },
        );
        updated += 1;
      }

      checked += 1;
      console.log(
        `[${checked}/${hotels.length}] cover checked · ${indexedHotel.hotelId} · ${String(indexedHotel.name || "Unknown hotel").trim()}`,
      );
    } catch (error) {
      if (error?.statusCode === 429) {
        stoppedByRateLimit = true;
        break;
      }

      checked += 1;
      console.log(
        `[${checked}/${hotels.length}] cover error · ${indexedHotel.hotelId}`,
      );
    }

    if (checked < hotels.length) await sleep(delay);
  }

  return { checked, updated, stoppedByRateLimit };
}

export async function indexHotelVideos({
  targets = DEFAULT_VIDEO_INDEX_TARGETS,
  maxChecks = 12,
  delayMs = 10000,
  staleAfterDays = 30,
} = {}) {
  const max = Math.min(Math.max(Number(maxChecks) || 12, 1), 200);
  const delay = Math.max(Number(delayMs) || 10000, 3000);
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
        starRating: "5.0",
        limit: 100,
        offset: 0,
      });
    } catch (error) {
      if (error?.statusCode === 429) {
        stoppedByRateLimit = true;
        break;
      }
      console.log(`catalog error · ${target.cityName}`);
      if (checked < max) await sleep(delay);
      continue;
    }

    const hotelIds = Array.isArray(catalog?.hotelIds) ? catalog.hotelIds : [];
    let candidateId = "";

    for (const hotelId of hotelIds) {
      const fresh = await HotelVideoIndex.exists({
        hotelId,
        checkedAt: { $gte: staleBefore },
      });

      if (fresh) {
        skippedFresh += 1;
        continue;
      }

      candidateId = hotelId;
      break;
    }

    if (!candidateId) {
      console.log(`no unchecked 5★ candidate · ${target.cityName}`);
      if (checked < max) await sleep(delay);
      continue;
    }

    try {
      const payload = await getNuiteeHotel(candidateId);
      const hotel = unwrapHotel(payload);
      const videoUrl = findHotelVideoUrl(payload);
      const stars = numericStars(hotel) || 5;

      await HotelVideoIndex.findOneAndUpdate(
        { hotelId: candidateId },
        {
          $set: {
            hotelId: candidateId,
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
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      );

      checked += 1;

      if (videoUrl) {
        videosFound += 1;
        console.log(
          `[${checked}/${max}] VIDEO FOUND · ${target.countryCode} · ${target.cityName} · ${candidateId} · ${String(hotel?.name || hotel?.hotelName || "Unknown hotel").trim()}`,
        );
      } else {
        console.log(
          `[${checked}/${max}] checked · ${target.countryCode} · ${target.cityName} · ${candidateId} · no video`,
        );
      }
    } catch (error) {
      if (error?.statusCode === 429) {
        stoppedByRateLimit = true;
        break;
      }

      checked += 1;
      console.log(
        `[${checked}/${max}] checked · ${target.countryCode} · ${target.cityName} · ${candidateId} · detail error`,
      );
    }

    if (checked < max) {
      await sleep(delay);
    }
  }

  const indexedFiveStarHotels = await HotelVideoIndex.countDocuments({
    stars: { $gte: 5 },
  });
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
    indexedFiveStarHotels,
    indexedFiveStarVideos,
  };
}
