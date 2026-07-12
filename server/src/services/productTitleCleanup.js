import { Product } from "../models/Product.js";

const LONG_TITLE_MIN_CHARS = 95;
const LONG_TITLE_MIN_WORDS = 16;
const TARGET_MAX_CHARS = 72;
const TARGET_MAX_WORDS = 11;

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isExcessivelyLong(title) {
  const words = title.split(" ").filter(Boolean);
  return title.length >= LONG_TITLE_MIN_CHARS || words.length >= LONG_TITLE_MIN_WORDS;
}

function trimTrailingJoiners(value) {
  return value
    .replace(/[\s,;:|/\-–—]+$/g, "")
    .replace(/\b(?:and|or|with|for|of|the|a|an|ve|ile|için)$/i, "")
    .replace(/[\s,;:|/\-–—]+$/g, "")
    .trim();
}

function shortenTitle(originalTitle) {
  const title = normalizeWhitespace(originalTitle);
  const segments = title
    .split(/\s+(?:\||•|–|—|;|\/{2,})\s+/)
    .map((segment) => trimTrailingJoiners(segment))
    .filter(Boolean);

  const cleanSegment = segments.find(
    (segment) => segment.length >= 18 && segment.length <= TARGET_MAX_CHARS,
  );

  if (cleanSegment) {
    return cleanSegment;
  }

  const words = title.split(" ").filter(Boolean);
  const selectedWords = [];

  for (const word of words) {
    if (selectedWords.length >= TARGET_MAX_WORDS) break;

    const candidate = [...selectedWords, word].join(" ");
    if (candidate.length > TARGET_MAX_CHARS) break;

    selectedWords.push(word);
  }

  let shortened = trimTrailingJoiners(selectedWords.join(" "));

  if (shortened.length < 18) {
    shortened = trimTrailingJoiners(title.slice(0, TARGET_MAX_CHARS).replace(/\s+\S*$/, ""));
  }

  return shortened || title;
}

function mergeDescription(existingDescription, originalTitle) {
  const description = normalizeWhitespace(existingDescription);
  if (!description) return originalTitle;
  if (description.includes(originalTitle)) return description;
  return `${description}\n\n${originalTitle}`;
}

export async function normalizeExcessivelyLongProductTitles() {
  const candidates = await Product.find({
    $expr: {
      $gte: [
        { $strLenCP: { $ifNull: ["$title", ""] } },
        80,
      ],
    },
  })
    .select({ _id: 1, title: 1, description: 1 })
    .lean();

  const operations = [];

  for (const product of candidates) {
    const originalTitle = normalizeWhitespace(product.title);
    if (!isExcessivelyLong(originalTitle)) continue;

    const shortTitle = shortenTitle(originalTitle);
    if (!shortTitle || shortTitle === originalTitle) continue;

    operations.push({
      updateOne: {
        filter: { _id: product._id, title: product.title },
        update: {
          $set: {
            title: shortTitle,
            description: mergeDescription(product.description, originalTitle),
          },
        },
      },
    });
  }

  if (!operations.length) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  return Product.bulkWrite(operations, { ordered: false });
}
