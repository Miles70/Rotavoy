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
  const products = await Product.find({
    source: "cj",
    supplierProductId: { $ne: "" },
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
    const groupByVariantId = buildCjVariantGroupMap(siblings.map(toGroupingVariant));
    for (const product of siblings) {
      const variantId = String(product.supplierVariantId || "").trim();
      const variantGroupKey = groupByVariantId.get(variantId) || "standard-band-1";
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
