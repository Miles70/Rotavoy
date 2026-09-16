import { Product } from "../models/Product.js";
import { buildCjVariantGroupMap } from "./cjVariantGrouping.js";

const BULK_BATCH_SIZE = 500;

function toGroupingVariant(product) {
  return {
    vid: String(product.supplierVariantId || "").trim(),
    variantKey: product.supplierContent?.variant ||
      product.details?.variant ||
      product.supplierSku ||
      "Default",
    variantSellPrice: Number(product.costPrice || 0),
  };
}

export async function groupExistingCjVariants() {
  const pendingParentIds = await Product.distinct("supplierProductId", {
    source: "cj",
    supplierProductId: { $ne: "" },
    supplierVariantId: { $ne: "" },
    $or: [
      { variantGroupKey: "" },
      { variantGroupKey: null },
      { variantGroupKey: { $exists: false } },
    ],
  });

  const supplierProductIds = pendingParentIds
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (!supplierProductIds.length) {
    return {
      checkedCount: 0,
      parentProductCount: 0,
      modifiedCount: 0,
    };
  }

  // Only load complete sibling sets for parents that actually have an
  // ungrouped variant. Re-reading every CJ product on every server start made
  // cold starts unnecessarily expensive once the catalog was already grouped.
  const products = await Product.find({
    source: "cj",
    supplierProductId: { $in: supplierProductIds },
    supplierVariantId: { $ne: "" },
  })
    .select({
      _id: 1,
      supplierProductId: 1,
      supplierVariantId: 1,
      supplierSku: 1,
      supplierContent: 1,
      details: 1,
      costPrice: 1,
      variantGroupKey: 1,
    })
    .lean();

  const bySupplierProduct = new Map();
  for (const product of products) {
    const productId = String(product.supplierProductId || "").trim();
    if (!bySupplierProduct.has(productId)) bySupplierProduct.set(productId, []);
    bySupplierProduct.get(productId).push(product);
  }

  const operations = [];
  for (const siblings of bySupplierProduct.values()) {
    const groupByVariantId = buildCjVariantGroupMap(
      siblings.map(toGroupingVariant),
      {
        productTitle: siblings[0]?.supplierContent?.title || "",
      },
    );
    for (const product of siblings) {
      const variantId = String(product.supplierVariantId || "").trim();
      const variantGroupKey = groupByVariantId.get(variantId) || "product";
      if (product.variantGroupKey === variantGroupKey) continue;
      operations.push({
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { variantGroupKey } },
        },
      });
    }
  }

  let modifiedCount = 0;
  for (let offset = 0; offset < operations.length; offset += BULK_BATCH_SIZE) {
    const result = await Product.bulkWrite(
      operations.slice(offset, offset + BULK_BATCH_SIZE),
      { ordered: false },
    );
    modifiedCount += result.modifiedCount || 0;
  }

  return {
    checkedCount: products.length,
    parentProductCount: bySupplierProduct.size,
    modifiedCount,
  };
}
