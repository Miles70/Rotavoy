import { getCjProductVideos } from "./cjApi.js";

function normalizeCjMediaUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return "";
    if (hostname !== "cjdropshipping.com" && !hostname.endsWith(".cjdropshipping.com")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function selectCjProductVideo(rows) {
  const video = (Array.isArray(rows) ? rows : []).find((row) => {
    const isAvailable = String(row?.videoState || "ON_STATE").toUpperCase() === "ON_STATE";
    const canUse = String(row?.isFree || "") === "1" || row?.isBuy === true;
    return isAvailable && canUse && normalizeCjMediaUrl(row?.videoUrl);
  });

  if (!video) return { videoUrl: "", videoPosterUrl: "", hasVideo: false };

  return {
    videoUrl: normalizeCjMediaUrl(video.videoUrl),
    videoPosterUrl: normalizeCjMediaUrl(video.coverURL),
    hasVideo: true,
  };
}

export async function getCjProductVideoMedia(detail, productId) {
  const videoIds = Array.isArray(detail?.productVideo) ? detail.productVideo : [];
  const hasVideoHint = Number(detail?.isVideo || 0) === 1 || videoIds.length > 0;

  if (!hasVideoHint) {
    return { checked: true, videoUrl: "", videoPosterUrl: "", hasVideo: false };
  }

  try {
    const rows = await getCjProductVideos(productId);
    return { checked: true, ...selectCjProductVideo(rows) };
  } catch (error) {
    console.warn(`CJ video metadata skipped for ${productId}:`, error.message);
    return { checked: false };
  }
}
