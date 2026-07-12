import { Product } from "../models/Product.js";

const QUALITY_SOURCE = "amazon-reviews-2023";
const PRESERVED_SOURCES = [QUALITY_SOURCE, "manual"];
const MIN_QUALITY_PRODUCT_COUNT = 500;

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function looksLikeOriginalLongTitle(currentTitle, candidate) {
  const cleanCurrent = normalizeWhitespace(currentTitle);
  const cleanCandidate = normalizeWhitespace(candidate);
  const candidateWordCount = cleanCandidate.split(" ").filter(Boolean).length;

  if (!cleanCurrent || !cleanCandidate || cleanCandidate === cleanCurrent) {
    return false;
  }

  if (cleanCandidate.length < 95 && candidateWordCount < 16) {
    return false;
  }

  return cleanCandidate.toLowerCase().startsWith(cleanCurrent.toLowerCase());
}

function buildTitleRestoreUpdate(product) {
  const rawDescription = String(product.description || "").trim();
  if (!rawDescription) return null;

  const paragraphs = rawDescription
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const candidate = paragraphs.at(-1) || "";
  if (!looksLikeOriginalLongTitle(product.title, candidate)) {
    return null;
  }

  return {
    title: normalizeWhitespace(candidate),
    description: paragraphs.slice(0, -1).join("\n\n"),
  };
}

async function restorePreviouslyShortenedAmazonTitles() {
  const candidates = await Product.find({
    source: QUALITY_SOURCE,
    description: { $type: "string", $ne: "" },
  })
    .select({ _id: 1, title: 1, description: 1 })
    .lean();

  const operations = candidates
    .map((product) => {
      const restored = buildTitleRestoreUpdate(product);
      if (!restored) return null;

      return {
        updateOne: {
          filter: { _id: product._id, title: product.title },
          update: { $set: restored },
        },
      };
    })
    .filter(Boolean);

  if (!operations.length) {
    return { modifiedCount: 0 };
  }

  return Product.bulkWrite(operations, { ordered: false });
}

export async function cleanCatalogQuality() {
  const qualityProductCount = await Product.countDocuments({
    source: QUALITY_SOURCE,
  });

  if (qualityProductCount < MIN_QUALITY_PRODUCT_COUNT) {
    return {
      skipped: true,
      qualityProductCount,
      restoredTitleCount: 0,
      deletedLowQualityCount: 0,
    };
  }

  const restoreResult = await restorePreviouslyShortenedAmazonTitles();
  const deleteResult = await Product.deleteMany({
    source: { $nin: PRESERVED_SOURCES },
  });

  return {
    skipped: false,
    qualityProductCount,
    restoredTitleCount: restoreResult.modifiedCount || 0,
    deletedLowQualityCount: deleteResult.deletedCount || 0,
  };
}
