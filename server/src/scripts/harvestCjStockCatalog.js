import "dotenv/config";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const PAGE_SIZE = Math.min(
  Math.max(Number.parseInt(process.env.ROTAVOY_CJ_HARVEST_PAGE_SIZE || "100", 10) || 100, 1),
  100,
);
const COUNTRY_CODE = String(
  process.env.ROTAVOY_CJ_HARVEST_COUNTRY ||
  process.env.CJ_FROM_COUNTRY_CODE ||
  "CN",
).trim().toUpperCase();
const RETRY_LIMIT = Math.min(
  Math.max(Number.parseInt(process.env.ROTAVOY_CJ_HARVEST_RETRIES || "4", 10) || 4, 1),
  10,
);
const RETRY_BASE_DELAY_MS = Math.min(
  Math.max(Number.parseInt(process.env.ROTAVOY_CJ_HARVEST_RETRY_BASE_MS || "15000", 10) || 15000, 1000),
  5 * 60_000,
);
const RETRY_MAX_DELAY_MS = Math.max(
  RETRY_BASE_DELAY_MS,
  Math.min(
    Math.max(Number.parseInt(process.env.ROTAVOY_CJ_HARVEST_RETRY_MAX_MS || "60000", 10) || 60000, 1000),
    10 * 60_000,
  ),
);

const CHECKPOINT_PATH = path.resolve(
  process.cwd(),
  process.env.ROTAVOY_CJ_HARVEST_CHECKPOINT || ".rotavoy-cj-stock-harvest.json",
);

process.env.ROTAVOY_CONTENT_ENRICH_ON_SYNC = "false";
process.env.CJ_REPLACE_LEGACY_CATALOG = "false";

const [
  { connectDatabase, disconnectDatabase },
  { Product },
  { getCjCategories, listCjProducts },
  { syncCjProductsByIds },
] = await Promise.all([
  import("../config/database.js"),
  import("../models/Product.js"),
  import("../services/cjApi.js"),
  import("../services/cjCatalogSync.js"),
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientCjError(error) {
  const statusCode = Number(error?.statusCode || 0);
  if ([429, 502, 503, 504].includes(statusCode)) return true;

  const message = String(error?.message || error || "");
  return /too many requests|qps limit|rate limit|timeout|timed out|could not be reached|system busy|temporar|network|fetch failed|econnreset|etimedout|socket|502|503|504/i.test(message);
}

async function withRetry(label, task) {
  let lastError = null;

  for (let attempt = 1; attempt <= RETRY_LIMIT + 1; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const retriesUsed = attempt - 1;
      if (!isTransientCjError(error) || retriesUsed >= RETRY_LIMIT) {
        throw error;
      }

      const delayMs = Math.min(
        RETRY_BASE_DELAY_MS * (2 ** retriesUsed),
        RETRY_MAX_DELAY_MS,
      );
      console.log(
        `[retry] ${label}: ${String(error?.message || error)}. Waiting ${Math.ceil(delayMs / 1000)}s (${attempt}/${RETRY_LIMIT}).`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

function flattenCategories(data) {
  const categories = [];
  const seen = new Set();

  for (const first of Array.isArray(data) ? data : []) {
    for (const second of Array.isArray(first?.categoryFirstList) ? first.categoryFirstList : []) {
      for (const third of Array.isArray(second?.categorySecondList) ? second.categorySecondList : []) {
        const id = String(third?.categoryId || "").trim();
        if (!id || seen.has(id)) continue;

        seen.add(id);
        categories.push({
          id,
          first: String(first?.categoryFirstName || "").trim(),
          second: String(second?.categorySecondName || "").trim(),
          third: String(third?.categoryName || "").trim(),
        });
      }
    }
  }

  return categories;
}

function flattenListV2(data) {
  const content = Array.isArray(data?.content) ? data.content : [];
  return content.flatMap((entry) => (
    Array.isArray(entry?.productList) ? entry.productList : []
  ));
}

function getProductId(product) {
  return String(product?.id || product?.pid || "").trim();
}

async function readCheckpoint() {
  if (String(process.env.ROTAVOY_CJ_HARVEST_RESET || "").toLowerCase() === "true") {
    await unlink(CHECKPOINT_PATH).catch(() => undefined);
    return null;
  }

  try {
    const raw = await readFile(CHECKPOINT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || parsed?.countryCode !== COUNTRY_CODE) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCheckpoint(state) {
  const next = {
    ...state,
    version: 1,
    countryCode: COUNTRY_CODE,
    updatedAt: new Date().toISOString(),
  };
  const tempPath = `${CHECKPOINT_PATH}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(tempPath, CHECKPOINT_PATH);
}

async function getActiveCjParentCount() {
  const ids = await Product.distinct("supplierProductId", {
    source: "cj",
    supplierProductId: { $ne: "" },
    isActive: true,
    stock: { $gt: 0 },
  });
  return ids.filter(Boolean).length;
}

async function syncProductPage(products, categoryLabel, page) {
  const ids = [...new Set(products.map(getProductId).filter(Boolean))];
  let pending = ids;
  let imported = 0;
  let skipped = 0;
  let activeVariants = 0;
  const permanentFailures = [];

  for (let attempt = 1; attempt <= RETRY_LIMIT + 1 && pending.length > 0; attempt += 1) {
    const result = await syncCjProductsByIds(pending);
    imported += Number(result?.importedProducts || 0);
    skipped += Number(result?.skippedProducts || 0);
    activeVariants += Number(result?.activeVariants || 0);

    const transientFailures = [];
    for (const item of Array.isArray(result?.results) ? result.results : []) {
      if (item?.status !== "failed") continue;
      const error = new Error(String(item?.error || "CJ product import failed"));
      if (isTransientCjError(error) && attempt <= RETRY_LIMIT) {
        transientFailures.push(String(item.pid || "").trim());
      } else {
        permanentFailures.push({
          pid: String(item?.pid || "").trim(),
          error: String(item?.error || "unknown error"),
        });
      }
    }

    pending = transientFailures.filter(Boolean);
    if (pending.length < 1) break;

    const delayMs = Math.min(
      RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)),
      RETRY_MAX_DELAY_MS,
    );
    console.log(
      `[retry] ${categoryLabel} page ${page}: ${pending.length} products will retry in ${Math.ceil(delayMs / 1000)}s.`,
    );
    await sleep(delayMs);
  }

  for (const pid of pending) {
    permanentFailures.push({
      pid,
      error: "Retry limit reached",
    });
  }

  return {
    discovered: ids.length,
    imported,
    skipped,
    activeVariants,
    failed: permanentFailures.length,
    failures: permanentFailures,
  };
}

const initialState = {
  version: 1,
  countryCode: COUNTRY_CODE,
  completedCategoryIds: [],
  currentCategoryId: "",
  nextPage: 1,
  pagesProcessed: 0,
  productsDiscovered: 0,
  productsProcessed: 0,
  productsFailed: 0,
  completed: false,
};

let state = { ...initialState };

try {
  await connectDatabase();

  const startingActive = await getActiveCjParentCount();
  const categoryTree = await withRetry("CJ category list", () => getCjCategories());
  const categories = flattenCategories(categoryTree);

  if (categories.length < 1) {
    throw new Error("CJ returned no third-level categories.");
  }

  const checkpoint = await readCheckpoint();
  if (checkpoint?.completed) {
    console.log(
      `CJ stock harvest was already completed for ${COUNTRY_CODE}. Set ROTAVOY_CJ_HARVEST_RESET=true to run a fresh full scan.`,
    );
  } else {
    state = checkpoint ? { ...initialState, ...checkpoint } : { ...initialState };
    const completed = new Set(
      Array.isArray(state.completedCategoryIds) ? state.completedCategoryIds : [],
    );

    console.log(`Rotavoy full CJ stock harvest starting with ${startingActive} active CJ products.`);
    console.log(
      `Scope: all CJ third-level categories, verified ${COUNTRY_CODE} warehouse inventory >= 1, no Luna enrichment.`,
    );
    console.log(
      `Resume checkpoint: ${CHECKPOINT_PATH}. Categories: ${categories.length}. Page size: ${PAGE_SIZE}.`,
    );

    for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex += 1) {
      const category = categories[categoryIndex];
      if (completed.has(category.id)) continue;

      let page = state.currentCategoryId === category.id
        ? Math.max(Number(state.nextPage || 1), 1)
        : 1;

      const label = [category.first, category.second, category.third]
        .filter(Boolean)
        .join(" > ");

      console.log(
        `\n=== [${categoryIndex + 1}/${categories.length}] ${label || category.id} ===`,
      );

      while (page <= 1000) {
        const data = await withRetry(
          `${label || category.id} page ${page}`,
          () => listCjProducts({
            page,
            size: PAGE_SIZE,
            categoryId: category.id,
            countryCode: COUNTRY_CODE,
            startWarehouseInventory: 1,
            verifiedWarehouse: 1,
            sort: "asc",
            orderBy: 3,
          }),
        );

        const products = flattenListV2(data);
        const reportedTotalPages = Math.max(Number(data?.totalPages || 0), 0);
        const totalPages = reportedTotalPages > 0
          ? Math.min(reportedTotalPages, 1000)
          : page;

        if (reportedTotalPages > 1000) {
          console.log(
            `[notice] ${label || category.id} reports ${reportedTotalPages} pages; CJ listV2 exposes at most 1000 pages per query.`,
          );
        }

        if (products.length < 1) {
          console.log(`Page ${page}: no in-stock products returned.`);
          break;
        }

        const pageResult = await syncProductPage(products, label || category.id, page);
        state.pagesProcessed += 1;
        state.productsDiscovered += pageResult.discovered;
        state.productsProcessed += pageResult.imported + pageResult.skipped;
        state.productsFailed += pageResult.failed;
        state.currentCategoryId = category.id;
        state.nextPage = page + 1;

        await writeCheckpoint(state);

        console.log(
          `Page ${page}/${totalPages}: ${pageResult.discovered} candidates, ${pageResult.imported} synced, ${pageResult.skipped} skipped, ${pageResult.failed} failed.`,
        );

        if (page >= totalPages || products.length < PAGE_SIZE) break;
        page += 1;
      }

      completed.add(category.id);
      state.completedCategoryIds = [...completed];
      state.currentCategoryId = "";
      state.nextPage = 1;
      await writeCheckpoint(state);
    }

    state.completed = true;
    await writeCheckpoint(state);

    const endingActive = await getActiveCjParentCount();
    console.log("\nRotavoy full CJ stock harvest complete.");
    console.log(`Active CJ catalog: ${startingActive} -> ${endingActive} (${endingActive - startingActive >= 0 ? "+" : ""}${endingActive - startingActive}).`);
    console.log(
      `Pages processed: ${state.pagesProcessed}; candidates seen: ${state.productsDiscovered}; synced/skipped: ${state.productsProcessed}; failed: ${state.productsFailed}.`,
    );
  }
} catch (error) {
  console.error("Rotavoy full CJ stock harvest failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
