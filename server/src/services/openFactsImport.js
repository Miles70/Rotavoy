import { Product } from "../models/Product.js";

const DEFAULT_TARGET = 2000;
const PAGE_SIZE = 100;
const MIN_REQUEST_DELAY_MS = 6100;
const MAX_PAGES_PER_SOURCE = 80;

const LEGACY_DEMO_KEYS = [
  "macbookPro",
  "smartWatch",
  "smartphonePro",
  "mirrorlessCamera",
  "wirelessHeadphones",
  "tabletPro",
  "bluetoothSpeaker",
  "basicTshirt",
  "runningShoes",
  "classicSunglasses",
  "urbanBackpack",
  "premiumHoodie",
  "leatherJacket",
  "deskLamp",
  "officeChair",
  "modernSofa",
  "coffeeMaker",
  "indoorPlant",
  "woodenTable",
  "gamingHeadset",
  "mechanicalKeyboard",
  "wirelessController",
  "gamingMouse",
  "gamingMonitor",
  "streamingMicrophone",
];

const SOURCE_CONFIGS = [
  {
    type: "product",
    baseUrl: "https://world.openproductsfacts.org",
    categoryKey: "marketplace",
    categoryLabel: "Marketplace",
    icon: "📦",
    weight: 0.4,
    minPrice: 8,
    maxPrice: 1200,
  },
  {
    type: "food",
    baseUrl: "https://world.openfoodfacts.org",
    categoryKey: "groceries",
    categoryLabel: "Groceries",
    icon: "🛒",
    weight: 0.3,
    minPrice: 2,
    maxPrice: 80,
  },
  {
    type: "beauty",
    baseUrl: "https://world.openbeautyfacts.org",
    categoryKey: "beauty",
    categoryLabel: "Beauty & Care",
    icon: "✨",
    weight: 0.2,
    minPrice: 5,
    maxPrice: 250,
  },
  {
    type: "petfood",
    baseUrl: "https://world.openpetfoodfacts.org",
    categoryKey: "pet-supplies",
    categoryLabel: "Pet Supplies",
    icon: "🐾",
    weight: 0.1,
    minPrice: 4,
    maxPrice: 150,
  },
];

const REQUEST_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "generic_name",
  "brands",
  "categories",
  "categories_tags",
  "quantity",
  "image_front_url",
  "image_url",
  "selected_images",
].join(",");

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function hashString(value) {
  let hash = 2166136261;

  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function deterministicMoney(hash, minimum, maximum) {
  const spread = Math.max(1, maximum - minimum);
  const whole = minimum + (hash % spread);
  return Number(`${whole}.99`);
}

function collectImageUrls(value, output = []) {
  if (!value) return output;

  if (typeof value === "string") {
    if (/^https:\/\//i.test(value)) output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, output));
    return output;
  }

  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectImageUrls(item, output));
  }

  return output;
}

function getProductTitle(product) {
  return cleanText(
    product.product_name ||
      product.product_name_en ||
      product.generic_name
  );
}

function getImages(product) {
  return [
    product.image_front_url,
    product.image_url,
    ...collectImageUrls(product.selected_images),
  ]
    .filter((url) => /^https:\/\//i.test(String(url || "")))
    .filter((url, index, array) => array.indexOf(url) === index)
    .slice(0, 8);
}

function getOriginalCategory(product) {
  const categoryText = cleanText(product.categories);
  if (categoryText) return categoryText.split(",")[0].trim();

  const firstTag = Array.isArray(product.categories_tags)
    ? product.categories_tags[0]
    : "";

  return cleanText(firstTag).replace(/^[a-z]{2}:/i, "").replace(/-/g, " ");
}

function normalizeOpenFactsProduct(product, source, position) {
  const code = cleanText(product.code);
  const title = getProductTitle(product);
  const images = getImages(product);

  if (!code || title.length < 2 || images.length === 0) return null;

  const fingerprint = hashString(`${source.type}:${code}`);
  const price = deterministicMoney(
    fingerprint,
    source.minPrice,
    source.maxPrice
  );
  const hasDiscount = fingerprint % 4 === 0;
  const discountPercent = 10 + (fingerprint % 26);
  const oldPrice = hasDiscount
    ? Number((price / (1 - discountPercent / 100)).toFixed(2))
    : null;
  const brand = cleanText(product.brands).split(",")[0].trim();
  const quantity = cleanText(product.quantity);
  const originalCategory = getOriginalCategory(product);

  const descriptionParts = [brand, quantity, originalCategory].filter(Boolean);
  const description =
    descriptionParts.length > 0
      ? descriptionParts.join(" • ")
      : `Imported from ${source.categoryLabel} catalog.`;

  return {
    key: `openfacts-${source.type}-${code}`,
    title,
    description,
    brand,
    quantity,
    categoryKey: source.categoryKey,
    categoryLabel: source.categoryLabel,
    price,
    oldPrice,
    badge: hasDiscount
      ? "sale"
      : fingerprint % 3 === 0
        ? "new"
        : "stock",
    image: source.icon,
    imageUrl: images[0],
    images,
    stock: 10 + (fingerprint % 290),
    rating: Number((3.5 + (fingerprint % 15) / 10).toFixed(1)),
    reviewCount: 10 + (fingerprint % 2990),
    popularity: Math.max(1, 100000 - position),
    source: "openfacts",
    sourceType: source.type,
    sourceCode: code,
    sourceUrl: `${source.baseUrl}/product/${encodeURIComponent(code)}`,
    isActive: true,
  };
}

function buildSearchUrl(source, page) {
  const url = new URL("/api/v2/search", source.baseUrl);
  url.searchParams.set("fields", REQUEST_FIELDS);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(PAGE_SIZE));
  url.searchParams.set("sort_by", "unique_scans_n");
  return url;
}

async function fetchJsonWithRetry(url, headers, attempt = 1) {
  const response = await fetch(url, { headers });

  if (response.ok) return response.json();

  if ([429, 503].includes(response.status) && attempt < 4) {
    await sleep(15000 * attempt);
    return fetchJsonWithRetry(url, headers, attempt + 1);
  }

  throw new Error(
    `Open Facts request failed (${response.status}) for ${url.hostname}.`
  );
}

function allocateQuotas(target) {
  let allocated = 0;

  return SOURCE_CONFIGS.map((source, index) => {
    const isLast = index === SOURCE_CONFIGS.length - 1;
    const quota = isLast
      ? target - allocated
      : Math.floor(target * source.weight);

    allocated += quota;
    return { ...source, quota };
  });
}

async function collectSourceProducts({
  source,
  desiredCount,
  seenKeys,
  requestDelayMs,
  userAgent,
  startPage = 1,
  startingPosition = 0,
}) {
  const collected = [];
  let page = startPage;
  let exhausted = false;

  while (
    collected.length < desiredCount &&
    page <= MAX_PAGES_PER_SOURCE &&
    !exhausted
  ) {
    const url = buildSearchUrl(source, page);
    const payload = await fetchJsonWithRetry(url, {
      Accept: "application/json",
      "User-Agent": userAgent,
    });

    const remoteProducts = Array.isArray(payload.products)
      ? payload.products
      : [];

    if (remoteProducts.length === 0) {
      exhausted = true;
      break;
    }

    for (const remoteProduct of remoteProducts) {
      const normalized = normalizeOpenFactsProduct(
        remoteProduct,
        source,
        startingPosition + collected.length
      );

      if (!normalized || seenKeys.has(normalized.key)) continue;

      seenKeys.add(normalized.key);
      collected.push(normalized);

      if (collected.length >= desiredCount) break;
    }

    console.log(
      `[${source.type}] page ${page}: ${collected.length}/${desiredCount} usable products`
    );

    page += 1;

    if (collected.length < desiredCount && !exhausted) {
      await sleep(requestDelayMs);
    }
  }

  return { products: collected, nextPage: page, exhausted };
}

async function writeProducts(products) {
  const batchSize = 500;
  let matchedCount = 0;
  let modifiedCount = 0;
  let upsertedCount = 0;

  for (let index = 0; index < products.length; index += batchSize) {
    const batch = products.slice(index, index + batchSize);
    const result = await Product.bulkWrite(
      batch.map((product) => ({
        updateOne: {
          filter: { key: product.key },
          update: { $set: product },
          upsert: true,
        },
      })),
      { ordered: false }
    );

    matchedCount += result.matchedCount || 0;
    modifiedCount += result.modifiedCount || 0;
    upsertedCount += result.upsertedCount || 0;
  }

  return { matchedCount, modifiedCount, upsertedCount };
}

export async function importOpenFactsCatalog(options = {}) {
  const target = toPositiveInteger(
    options.target ?? process.env.OPENFACTS_TARGET,
    DEFAULT_TARGET
  );
  const configuredDelay = toPositiveInteger(
    options.requestDelayMs ?? process.env.OPENFACTS_REQUEST_DELAY_MS,
    6500
  );
  const requestDelayMs = Math.max(MIN_REQUEST_DELAY_MS, configuredDelay);
  const userAgent = cleanText(
    options.userAgent ??
      process.env.OPENFACTS_USER_AGENT ??
      "Kemalreis/0.1 (https://github.com/Miles70/kemalreis)"
  );

  const sources = allocateQuotas(target);
  const seenKeys = new Set();
  const products = [];
  const states = [];

  for (const source of sources) {
    const state = await collectSourceProducts({
      source,
      desiredCount: source.quota,
      seenKeys,
      requestDelayMs,
      userAgent,
      startingPosition: products.length,
    });

    products.push(...state.products);
    states.push({ source, ...state });

    if (products.length < target) await sleep(requestDelayMs);
  }

  let madeProgress = true;

  while (products.length < target && madeProgress) {
    madeProgress = false;

    for (const state of states) {
      if (products.length >= target || state.exhausted) continue;

      const remaining = target - products.length;
      const extra = await collectSourceProducts({
        source: state.source,
        desiredCount: Math.min(remaining, PAGE_SIZE),
        seenKeys,
        requestDelayMs,
        userAgent,
        startPage: state.nextPage,
        startingPosition: products.length,
      });

      state.nextPage = extra.nextPage;
      state.exhausted = extra.exhausted;

      if (extra.products.length > 0) {
        products.push(...extra.products);
        madeProgress = true;
      }

      if (products.length < target) await sleep(requestDelayMs);
    }
  }

  if (products.length < target) {
    throw new Error(
      `Open Facts returned only ${products.length} usable products. Existing demo products were not deleted.`
    );
  }

  const finalProducts = products.slice(0, target);
  const writeResult = await writeProducts(finalProducts);
  const activeKeys = finalProducts.map((product) => product.key);

  const [demoDeleteResult, staleDeleteResult] = await Promise.all([
    Product.deleteMany({ key: { $in: LEGACY_DEMO_KEYS } }),
    Product.deleteMany({
      source: "openfacts",
      key: { $nin: activeKeys },
    }),
  ]);

  return {
    target,
    importedCount: finalProducts.length,
    matchedCount: writeResult.matchedCount,
    modifiedCount: writeResult.modifiedCount,
    upsertedCount: writeResult.upsertedCount,
    deletedDemoCount: demoDeleteResult.deletedCount || 0,
    deletedStaleCount: staleDeleteResult.deletedCount || 0,
    sourceCounts: finalProducts.reduce((counts, product) => {
      counts[product.sourceType] = (counts[product.sourceType] || 0) + 1;
      return counts;
    }, {}),
  };
}
