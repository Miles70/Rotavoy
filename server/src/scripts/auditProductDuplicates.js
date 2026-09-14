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

function storefrontGroupKey(row) {
  const parent = clean(row?.supplierProductId);
  const logical = clean(row?.variantGroupKey);
  return parent ? (logical ? `${parent}:${logical}` : parent) : clean(row?.key);
}

function storefrontTitle(row) {
  return clean(row?.translations?.tr?.title || row?.title);
}

function storefrontRepresentatives(rows) {
  const groups = new Map();
  for (const row of rows) {
    const groupKey = storefrontGroupKey(row);
    if (!groupKey) continue;
    const existing = groups.get(groupKey);
    if (!existing || Number(row.price || 0) < Number(existing.price || 0)) {
      groups.set(groupKey, row);
    }
  }
  return [...groups.values()];
}

function summarize(items) {
  return items.map((item) => ({
    key: item.key,
    title: item.title,
    storefrontTitle: storefrontTitle(item),
    storefrontGroupKey: storefrontGroupKey(item),
    primaryImage: item.imageUrl || item.images?.[0] || "",
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
    .select("key title translations supplierProductId supplierVariantId variantGroupKey sourceUrl imageUrl images price stock source isActive supplierContent")
    .lean();

  const active = rows.filter((row) => row.isActive);
  const representatives = storefrontRepresentatives(active);
  const storefrontGroups = new Set(representatives.map(storefrontGroupKey));

  const duplicateVariantIds = groupBy(rows, (row) => row.supplierVariantId);
  const duplicateSourceUrls = groupBy(active, (row) => row.sourceUrl)
    .filter(([, items]) => distinctParents(items) > 1);
  const duplicateImages = groupBy(active, (row) => row.imageUrl || row.images?.[0])
    .filter(([, items]) => distinctParents(items) > 1);
  const duplicateSupplierTitles = groupBy(
    active,
    (row) => normalizedTitle(row.supplierContent?.title || row.title),
  ).filter(([, items]) => distinctParents(items) > 1);
  const duplicateStorefrontTitleAndImage = groupBy(
    representatives,
    (row) => {
      const title = storefrontTitle(row).toLocaleLowerCase("tr-TR");
      const image = clean(row.imageUrl || row.images?.[0]);
      return title && image ? `${title} || ${image}` : "";
    },
  );
  const duplicateStorefrontTitles = groupBy(
    representatives,
    (row) => storefrontTitle(row).toLocaleLowerCase("tr-TR"),
  );
  const duplicateStorefrontImages = groupBy(
    representatives,
    (row) => row.imageUrl || row.images?.[0],
  );

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
    visibleSameTitleAndImageGroups: duplicateStorefrontTitleAndImage.length,
    visibleSameTitleGroups: duplicateStorefrontTitles.length,
    visibleSameImageGroups: duplicateStorefrontImages.length,
  }, null, 2));

  printSection("VİTRİN: Aynı başlık ve aynı görselle görünen kartlar", duplicateStorefrontTitleAndImage);
  printSection("VİTRİN: Aynı başlıkla görünen kartlar", duplicateStorefrontTitles);
  printSection("VİTRİN: Aynı ana görselle görünen kartlar", duplicateStorefrontImages);
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
