import { Product } from "../models/Product.js";
import { getCjProductDetail, getCjVariantStock, listCjProducts } from "./cjApi.js";

const LEGACY_SOURCES = ["amazon-reviews-2023", "manual"];

function parsePositiveInt(value, fallback, max = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function getMarkupMultiplier() {
  const parsed = Number(process.env.CJ_PRICE_MARKUP || 1.65);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1.65;
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function cleanText(value, maxLength = 300) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeCategory(categoryName = "") {
  const value = String(categoryName).toLowerCase();
  if (/phone|computer|electronic|camera|audio|headphone|charger|smart/.test(value)) return "electronics";
  if (/clothing|apparel|shoe|bag|jewelry|watch|fashion/.test(value)) return "fashion";
  if (/beauty|makeup|skin|hair|personal care|cosmetic/.test(value)) return "beauty";
  if (/sport|outdoor|camp|fitness|cycling|travel/.test(value)) return "sports";
  if (/baby|kid|toy|child/.test(value)) return "baby";
  if (/pet|dog|cat|animal/.test(value)) return "pets";
  if (/automotive|car|motorcycle|vehicle/.test(value)) return "automotive";
  if (/tool|hardware|garden/.test(value)) return "tools";
  if (/game|gaming/.test(value)) return "gaming";
  if (/office|stationery/.test(value)) return "office";
  if (/appliance/.test(value)) return "appliances";
  return "home";
}

function flattenListV2(data) {
  const content = Array.isArray(data?.content) ? data.content : [];
  return content.flatMap((entry) => Array.isArray(entry?.productList) ? entry.productList : []);
}

function sumOriginStock(rows, originCountryCode) {
  const origin = String(originCountryCode || "CN").toUpperCase();
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    if (String(row?.countryCode || "").toUpperCase() !== origin) return sum;
    return sum + Math.max(Number(row?.totalInventoryNum || 0), 0);
  }, 0);
}

function buildVariantTitle(productTitle, variant) {
  const option = cleanText(variant?.variantKey || variant?.variantNameEn || "", 120);
  if (!option) return productTitle;
  if (productTitle.toLowerCase().includes(option.toLowerCase())) return productTitle;
  return `${productTitle} - ${option}`.slice(0, 300);
}

function uniqueUrls(values) {
  return [...new Set(values.filter((value) => /^https?:\/\//i.test(String(value || ""))))];
}

async function syncOneProduct(listProduct, options) {
  const pid = String(listProduct?.id || listProduct?.pid || "").trim();
  if (!pid) return { upserted: 0, skipped: 1 };

  const detail = await getCjProductDetail(pid);
  const variants = Array.isArray(detail?.variants) ? detail.variants : [];
  const selectedVariants = variants.slice(0, options.maxVariantsPerProduct);
  const productTitle = cleanText(detail?.productNameEn || detail?.nameEn || listProduct?.nameEn, 260);
  if (!productTitle || selectedVariants.length === 0) return { upserted: 0, skipped: 1 };

  const categoryLabel = cleanText(
    detail?.categoryName || listProduct?.threeCategoryName || listProduct?.twoCategoryName || listProduct?.oneCategoryName || "General",
    120,
  );
  const categoryKey = normalizeCategory(categoryLabel);
  const description = cleanText(detail?.description || listProduct?.description, 1800);
  const baseImage = detail?.productImage || detail?.bigImage || listProduct?.bigImage || "";
  let upserted = 0;

  for (const variant of selectedVariants) {
    const vid = String(variant?.vid || "").trim();
    if (!vid) continue;

    const costPrice = roundMoney(variant?.variantSellPrice);
    if (!(costPrice > 0)) continue;

    const stockRows = await getCjVariantStock(vid);
    const stock = sumOriginStock(stockRows, options.originCountryCode);
    if (stock <= 0) continue;

    const images = uniqueUrls([variant?.variantImage || "", baseImage]);
    const title = buildVariantTitle(productTitle, variant);
    const price = roundMoney(costPrice * options.markupMultiplier);
    const key = `cj-${vid}`;

    await Product.findOneAndUpdate(
      { key },
      {
        $set: {
          title,
          description,
          features: [],
          details: {
            supplier: "CJdropshipping",
            variant: cleanText(variant?.variantKey || variant?.variantNameEn, 160),
            sku: cleanText(variant?.variantSku, 100),
            originCountry: options.originCountryCode,
            weightGrams: Number(variant?.variantWeight || 0),
          },
          brand: cleanText(detail?.supplierName, 120),
          quantity: "",
          categoryKey,
          categoryLabel,
          price,
          oldPrice: null,
          currency: "USD",
          costPrice,
          badge: "stock",
          image: "🛍️",
          imageUrl: images[0] || "",
          images,
          stock,
          rating: 0,
          reviewCount: 0,
          popularity: Math.max(Number(listProduct?.listedNum || detail?.listedNum || 0), 0),
          source: "cj",
          sourceType: "dropshipping",
          sourceCode: vid,
          sourceUrl: "",
          supplier: "cj",
          supplierProductId: pid,
          supplierVariantId: vid,
          supplierSku: cleanText(variant?.variantSku, 100),
          isActive: true,
        },
        $setOnInsert: {
          sourceLanguage: "en",
          sourceHash: "",
          translations: {},
          translationMeta: {},
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    );

    upserted += 1;
  }

  return { upserted, skipped: upserted > 0 ? 0 : 1 };
}

export async function syncCjCatalog() {
  const keywords = String(process.env.CJ_SYNC_KEYWORDS || "travel,electronics,home,beauty,sports")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const maxProductsPerKeyword = parsePositiveInt(process.env.CJ_SYNC_PRODUCTS_PER_KEYWORD, 6, 25);
  const maxVariantsPerProduct = parsePositiveInt(process.env.CJ_SYNC_VARIANTS_PER_PRODUCT, 4, 12);
  const options = {
    maxVariantsPerProduct,
    markupMultiplier: getMarkupMultiplier(),
    originCountryCode: String(process.env.CJ_FROM_COUNTRY_CODE || "CN").toUpperCase(),
  };

  let importedProducts = 0;
  let upsertedVariants = 0;
  let skippedProducts = 0;

  for (const keyword of keywords) {
    const data = await listCjProducts({ page: 1, size: maxProductsPerKeyword, keyWord: keyword });
    const products = flattenListV2(data).slice(0, maxProductsPerKeyword);

    for (const product of products) {
      const result = await syncOneProduct(product, options);
      importedProducts += 1;
      upsertedVariants += result.upserted;
      skippedProducts += result.skipped;
    }
  }

  let deletedLegacyCount = 0;
  if (upsertedVariants > 0 && String(process.env.CJ_REPLACE_LEGACY_CATALOG || "true").toLowerCase() !== "false") {
    const cleanup = await Product.deleteMany({ source: { $in: LEGACY_SOURCES } });
    deletedLegacyCount = cleanup.deletedCount || 0;
  }

  return {
    keywords,
    importedProducts,
    upsertedVariants,
    skippedProducts,
    deletedLegacyCount,
    markupMultiplier: options.markupMultiplier,
    originCountryCode: options.originCountryCode,
  };
}
