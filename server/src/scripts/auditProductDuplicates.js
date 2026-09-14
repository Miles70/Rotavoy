import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { Product } from "../models/Product.js";

function clean(value) {
  return String(value || "").trim();
}

function normalizedTitle(value) {
  return clean(value)
    .toLocaleLowerCase("en-US")
    .replace(/[–—-]+/g, " ")
    .replace(/\b(?:black|white|pink|blue|red|green|purple|yellow|orange|gray|grey|beyaz|siyah|pembe|mavi|kırmızı|yeşil)\b/giu, " ")
    .replace(/\b\d+\s*(?:ml|l|pcs?|pieces?|adet|pack)\b/giu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function groupBy(rows, getKey) {
  const groups = new Map();
  for (const row of rows) {
    const key = clean(getKey(row));
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].filter(([, items]) => items.length > 1);
}

function distinctParents(items) {
  return new Set(items.map((item) => clean(item.supplierProductId) || clean(item.key))).size;
}

function summarize(items) {
  return items.map((item) => ({
    key: item.key,
    title: item.title,
    supplierProductId: item.supplierProductId,
    supplierVariantId: item.supplierVariantId,
    variantGroupKey: item.variantGroupKey,
    price: item.price,
    active: item.isActive,
  }));
}

function printSection(title, groups) {
  console.log(`\n=== ${title} (${groups.length}) ===`);
  if (!groups.length) {
    console.log("Bulunamadı.");
    return;
  }
  for (const [fingerprint, items] of groups.slice(0, 100)) {
    console.log(JSON.stringify({ fingerprint, products: summarize(items) }, null, 2));
  }
  if (groups.length > 100) console.log(`... ${groups.length - 100} grup daha var.`);
}

try {
  await connectDatabase();

  const rows = await Product.find({})
    .select("key title supplierProductId supplierVariantId variantGroupKey sourceUrl imageUrl images price stock source isActive supplierContent")
    .lean();

  const active = rows.filter((row) => row.isActive);
  const storefrontGroups = new Set(active.map((row) => {
    const parent = clean(row.supplierProductId);
    const logical = clean(row.variantGroupKey);
    return parent ? (logical ? `${parent}:${logical}` : parent) : clean(row.key);
  }).filter(Boolean));

  const duplicateVariantIds = groupBy(rows, (row) => row.supplierVariantId);
  const duplicateSourceUrls = groupBy(active, (row) => row.sourceUrl)
    .filter(([, items]) => distinctParents(items) > 1);
  const duplicateImages = groupBy(active, (row) => row.imageUrl || row.images?.[0])
    .filter(([, items]) => distinctParents(items) > 1);
  const duplicateSupplierTitles = groupBy(
    active,
    (row) => normalizedTitle(row.supplierContent?.title || row.title),
  ).filter(([, items]) => distinctParents(items) > 1);

  const highConfidenceKeys = new Set();
  for (const groups of [duplicateVariantIds, duplicateSourceUrls, duplicateImages]) {
    for (const [, items] of groups) {
      for (const item of items) highConfidenceKeys.add(item.key);
    }
  }

  console.log("\nROTAVOY KATALOG TEKRAR RAPORU");
  console.log(JSON.stringify({
    totalDatabaseRows: rows.length,
    activeRows: active.length,
    inactiveRows: rows.length - active.length,
    activeStorefrontProductGroups: storefrontGroups.size,
    highConfidenceDuplicateRows: highConfidenceKeys.size,
    duplicateSupplierVariantGroups: duplicateVariantIds.length,
    duplicateSourceUrlGroups: duplicateSourceUrls.length,
    duplicatePrimaryImageGroups: duplicateImages.length,
    suspiciousSimilarTitleGroups: duplicateSupplierTitles.length,
  }, null, 2));

  printSection("KESİN: Aynı tedarikçi varyant kimliği", duplicateVariantIds);
  printSection("KESİN: Farklı ürün kimliği ama aynı kaynak adresi", duplicateSourceUrls);
  printSection("GÜÇLÜ ŞÜPHE: Farklı ürün kimliği ama aynı ana görsel", duplicateImages);
  printSection("İNCELEME: Renk/hacim/adet çıkarılınca aynı başlık", duplicateSupplierTitles);
} catch (error) {
  console.error("Catalog duplicate audit failed:", error);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) await disconnectDatabase();
}
