import { Product } from "../models/Product.js";
import {
  getProductTranslationIntegrityIssues,
  productTranslationsComplete,
} from "./productTranslation.js";

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export async function auditProductLanguageIntegrity({ repair = false } = {}) {
  const products = await Product.find({
    source: "cj",
    isActive: true,
    "contentMeta.status": "ready",
    "contentMeta.provider": "openai",
  })
    .select({
      supplierProductId: 1,
      translations: 1,
      contentMeta: 1,
    })
    .lean();

  const affected = [];
  for (const product of products) {
    const issues = getProductTranslationIntegrityIssues(product.translations);
    if (!productTranslationsComplete(product.translations)) {
      issues.push("translation-set:incomplete");
    }
    const uniqueIssues = unique(issues);
    if (!uniqueIssues.length) continue;

    affected.push({
      supplierProductId: String(product.supplierProductId || "").trim(),
      issues: uniqueIssues,
    });
  }

  const affectedSupplierIds = unique(
    affected.map((item) => item.supplierProductId),
  );

  if (repair && affectedSupplierIds.length) {
    await Product.updateMany(
      {
        source: "cj",
        supplierProductId: { $in: affectedSupplierIds },
        isActive: true,
      },
      {
        $set: {
          "contentMeta.status": "pending",
          "contentMeta.error": "Language integrity audit requested re-enrichment.",
          "contentMeta.updatedAt": new Date(),
        },
      },
    );
  }

  const issuesBySupplier = new Map();
  for (const item of affected) {
    if (!item.supplierProductId) continue;
    const previous = issuesBySupplier.get(item.supplierProductId) || [];
    issuesBySupplier.set(item.supplierProductId, unique([...previous, ...item.issues]));
  }

  return {
    scannedVariants: products.length,
    affectedVariants: affected.length,
    affectedSupplierProducts: affectedSupplierIds.length,
    repairedSupplierProducts: repair ? affectedSupplierIds.length : 0,
    affected: [...issuesBySupplier.entries()].map(([supplierProductId, issues]) => ({
      supplierProductId,
      issues,
    })),
  };
}
