import { Product } from "../models/Product.js";
import { productTranslationsComplete } from "./productTranslation.js";

const CONTENT_VERSION = "rotavoy-ai-copy-v8";

function clean(value) {
  return String(value || "").trim();
}

export function duplicateCandidateScore(product) {
  let score = 0;
  if (product?.isActive) score += 100;
  if (Number(product?.stock || 0) > 0) score += 40;
  if (product?.contentMeta?.status === "ready") score += 30;
  if (product?.contentMeta?.version === CONTENT_VERSION) score += 20;
  if (productTranslationsComplete(product?.translations)) score += 20;
  if (clean(product?.imageUrl) || product?.images?.some(Boolean)) score += 10;
  if (clean(product?.description)) score += 5;
  return score;
}

export function chooseDuplicateSurvivor(products) {
  return [...products].sort((left, right) => {
    const scoreDifference = duplicateCandidateScore(right) - duplicateCandidateScore(left);
    if (scoreDifference) return scoreDifference;

    const updatedDifference = new Date(right?.updatedAt || 0).getTime() -
      new Date(left?.updatedAt || 0).getTime();
    if (updatedDifference) return updatedDifference;

    return clean(left?.key).localeCompare(clean(right?.key));
  })[0];
}

export async function auditExactCjDuplicates() {
  const rows = await Product.find({
    source: "cj",
    supplierVariantId: { $type: "string", $ne: "" },
  })
    .select("_id key supplierProductId supplierVariantId title description imageUrl images stock isActive contentMeta translations updatedAt")
    .lean();

  const byVariant = new Map();
  for (const row of rows) {
    const variantId = clean(row.supplierVariantId);
    if (!byVariant.has(variantId)) byVariant.set(variantId, []);
    byVariant.get(variantId).push(row);
  }

  const exactGroups = [];
  const conflictingGroups = [];

  for (const [supplierVariantId, products] of byVariant.entries()) {
    if (products.length < 2) continue;
    const parentIds = new Set(products.map((product) => clean(product.supplierProductId)));
    const summary = {
      supplierVariantId,
      parentIds: [...parentIds],
      products,
    };
    if (parentIds.size === 1 && !parentIds.has("")) exactGroups.push(summary);
    else conflictingGroups.push(summary);
  }

  const brokenVariants = await Product.find({
    source: "cj",
    isActive: true,
    $or: [
      { supplierProductId: { $not: { $type: "string" } } },
      { supplierProductId: "" },
      { supplierVariantId: { $not: { $type: "string" } } },
      { supplierVariantId: "" },
      { key: "" },
      { imageUrl: "", images: { $size: 0 } },
    ],
  })
    .select("_id key supplierProductId supplierVariantId title imageUrl images stock isActive")
    .lean();

  return { checkedRows: rows.length, exactGroups, conflictingGroups, brokenVariants };
}

export async function archiveExactCjDuplicates({ apply = false } = {}) {
  const audit = await auditExactCjDuplicates();
  const decisions = audit.exactGroups.map((group) => {
    const survivor = chooseDuplicateSurvivor(group.products);
    return {
      supplierVariantId: group.supplierVariantId,
      survivor,
      duplicates: group.products.filter((product) => String(product._id) !== String(survivor._id)),
    };
  });
  const duplicateIds = decisions.flatMap((decision) => decision.duplicates.map((product) => product._id));

  let archivedCount = 0;
  if (apply && duplicateIds.length) {
    const archivedAt = new Date();
    const operations = decisions.flatMap((decision) => decision.duplicates.map((duplicate) => ({
      updateOne: {
        filter: { _id: duplicate._id, isActive: true },
        update: {
          $set: {
            isActive: false,
            "contentMeta.duplicateOf": decision.survivor.key,
            "contentMeta.duplicateReason": "same-cj-parent-and-variant-id",
            "contentMeta.duplicateArchivedAt": archivedAt,
          },
        },
      },
    })));
    const result = await Product.bulkWrite(operations, { ordered: false });
    archivedCount = result.modifiedCount || 0;
  }

  return {
    mode: apply ? "apply" : "dry-run",
    checkedRows: audit.checkedRows,
    exactDuplicateGroups: decisions.length,
    duplicateRows: duplicateIds.length,
    archivedCount,
    conflictingVariantIdGroups: audit.conflictingGroups.length,
    brokenVariantRows: audit.brokenVariants.length,
    decisions: decisions.map((decision) => ({
      supplierVariantId: decision.supplierVariantId,
      keep: decision.survivor.key,
      archive: decision.duplicates.map((product) => product.key),
    })),
    conflicts: audit.conflictingGroups.map((group) => ({
      supplierVariantId: group.supplierVariantId,
      parentIds: group.parentIds,
      keys: group.products.map((product) => product.key),
    })),
    brokenVariants: audit.brokenVariants.map((product) => ({
      key: product.key,
      supplierProductId: product.supplierProductId,
      supplierVariantId: product.supplierVariantId,
      title: product.title,
    })),
  };
}
