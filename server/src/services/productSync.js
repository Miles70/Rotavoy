import { Product } from "../models/Product.js";

const LEGACY_FAKE_SOURCES = ["amazon-reviews-2023", "manual"];

export async function syncProductsFromCatalog() {
  const cleanupResult = await Product.deleteMany({
    source: { $in: LEGACY_FAKE_SOURCES },
  });

  return {
    matchedCount: cleanupResult.deletedCount || 0,
    modifiedCount: 0,
    upsertedCount: 0,
    deletedCount: cleanupResult.deletedCount || 0,
  };
}
