import "dotenv/config";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { getCjCategories, listCjProducts } from "../services/cjApi.js";
import { Product } from "../models/Product.js";

// Discovery only. This collection is never read by the storefront.
const COLLECTION = "cj_stock_candidates";
const PAGE_SIZE = 100;
const COUNTRY_CODE = String(process.env.ROTAVOY_CJ_HARVEST_COUNTRY || "CN").trim().toUpperCase();
// Sample distinct departments before deciding whether a wider scan is useful.
const MAX_CATEGORIES = Math.max(0, Number.parseInt(process.env.ROTAVOY_CJ_HARVEST_MAX_CATEGORIES || "12", 10) || 0);
const MAX_PAGES = Math.max(0, Number.parseInt(process.env.ROTAVOY_CJ_HARVEST_MAX_PAGES || "12", 10) || 0);
const CHECKPOINT_PATH = path.resolve(process.cwd(), ".rotavoy-cj-stock-harvest.json");

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function retry(label, task) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await task(); }
    catch (error) {
      const transient = [429, 502, 503, 504].includes(Number(error?.statusCode)) ||
        /too many requests|qps limit|rate limit|timeout|system busy|temporar|network|fetch failed|econnreset/i.test(String(error?.message || error));
      if (!transient || attempt >= 4) throw error;
      const delay = Math.min(15_000 * 2 ** attempt, 60_000);
      console.log(`[retry] ${label}: ${error.message}; waiting ${delay / 1000}s`);
      await sleep(delay);
    }
  }
}

function categoriesFrom(tree) {
  const result = [];
  const seen = new Set();
  for (const first of Array.isArray(tree) ? tree : []) {
    for (const second of first?.categoryFirstList || []) {
      for (const third of second?.categorySecondList || []) {
        const id = String(third?.categoryId || "").trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        result.push({
          id,
          first: String(first.categoryFirstName || ""),
          label: [first.categoryFirstName, second.categorySecondName, third.categoryName].filter(Boolean).join(" > "),
        });
      }
    }
  }
  return result;
}

// Pick distinct departments early in the pilot. The full scan still visits all categories.
function diversify(categories) {
  const groups = new Map();
  for (const category of categories) {
    const key = category.first || category.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(category);
  }
  const preferred = /home|kitchen|electronic|phone|pet|baby|beauty|health|sport|outdoor|travel|luggage|auto|car|garden|office/i;
  const keys = [...groups.keys()].sort((a, b) => Number(preferred.test(b)) - Number(preferred.test(a)) || a.localeCompare(b));
  const ordered = [];
  while (keys.some((key) => groups.get(key).length)) {
    for (const key of keys) {
      const next = groups.get(key).shift();
      if (next) ordered.push(next);
    }
  }
  return ordered;
}

function normalizeTitle(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

async function checkpointWrite(state) {
  const temp = CHECKPOINT_PATH + ".tmp";
  await writeFile(temp, JSON.stringify(state, null, 2) + "\n");
  await rename(temp, CHECKPOINT_PATH);
}

async function checkpointRead() {
  if (process.env.ROTAVOY_CJ_HARVEST_RESET === "true") {
    await unlink(CHECKPOINT_PATH).catch(() => {});
  }
  try {
    const state = JSON.parse(await readFile(CHECKPOINT_PATH, "utf8"));
    if (state.version === 2 && state.countryCode === COUNTRY_CODE) return state;
  } catch { /* First run or damaged checkpoint: upserts keep discovery idempotent. */ }
  return {
    version: 2, countryCode: COUNTRY_CODE, completedCategoryIds: [],
    currentCategoryId: "", nextPage: 1, pagesProcessed: 0, candidatesSeen: 0, completed: false,
  };
}

async function run() {
  await connectDatabase();
  const collection = mongoose.connection.collection(COLLECTION);
  await collection.createIndex({ countryCode: 1, pid: 1 }, { unique: true });
  await collection.createIndex({ countryCode: 1, status: 1, titleKey: 1 });
  const categories = diversify(categoriesFrom(await retry("categories", getCjCategories)));
  if (!categories.length) throw new Error("CJ returned no third-level categories; checkpoint unchanged.");
  const state = await checkpointRead();
  if (state.completed) {
    console.log("Discovery completed. Set ROTAVOY_CJ_HARVEST_RESET=true for a fresh scan.");
    return;
  }

  let categoriesThisRun = 0;
  let pagesThisRun = 0;
  const completed = new Set(state.completedCategoryIds);
  // Prefer finishing an interrupted page before starting a different department.
  if (state.currentCategoryId) {
    const index = categories.findIndex((category) => category.id === state.currentCategoryId);
    if (index >= 0) categories.unshift(...categories.splice(index, 1));
  }
  const existingPids = new Set();
  const existingTitles = new Set();
  for await (const product of Product.find({ source: "cj" })
    .select({ supplierProductId: 1, "supplierContent.title": 1 }).lean().cursor()) {
    if (product.supplierProductId) existingPids.add(String(product.supplierProductId));
    const title = normalizeTitle(product.supplierContent?.title);
    if (title.length >= 18) existingTitles.add(title);
  }
  // Earlier pilot candidates can contain products already present in the storefront.
  await collection.updateMany(
    { countryCode: COUNTRY_CODE, pid: { $in: [...existingPids] } },
    { $set: { status: "existing_product" } },
  );
  // Backfill the small pilot created before title matching was introduced.
  for await (const candidate of collection.find(
    { countryCode: COUNTRY_CODE, status: "candidate", titleKey: { $exists: false } },
    { projection: { title: 1 } },
  )) {
    const titleKey = normalizeTitle(candidate.title);
    await collection.updateOne({ _id: candidate._id }, {
      $set: { titleKey, ...(titleKey.length >= 18 && existingTitles.has(titleKey) ? { status: "possible_duplicate" } : {}) },
    });
  }
  console.log(`CJ candidate discovery: ${categories.length} categories, ${COUNTRY_CODE} warehouse, ${PAGE_SIZE} per page.`);
  console.log(`No products will be published. Resume: ${CHECKPOINT_PATH}`);

  for (const category of categories) {
    if (completed.has(category.id)) continue;
    if (MAX_CATEGORIES && categoriesThisRun >= MAX_CATEGORIES) break;
    categoriesThisRun += 1;
    let page = state.currentCategoryId === category.id ? state.nextPage : 1;
    let finished = false;

    while (page <= 1000) {
      if (MAX_PAGES && pagesThisRun >= MAX_PAGES) break;
      const data = await retry(`${category.label} page ${page}`, () => listCjProducts({
        page, size: PAGE_SIZE, categoryId: category.id, countryCode: COUNTRY_CODE,
        startWarehouseInventory: 1, verifiedWarehouse: 1, sort: "desc", orderBy: 1,
      }));
      if (!data || !Array.isArray(data.content)) {
        throw new Error(`Unexpected CJ response for ${category.id} page ${page}; checkpoint unchanged.`);
      }
      const products = data.content.flatMap((entry) => Array.isArray(entry?.productList) ? entry.productList : []);
      const byId = new Map(products.map((p) => [String(p?.id || p?.pid || "").trim(), p]));
      byId.delete("");
      const ids = [...byId.keys()];
      if (products.length && !ids.length) throw new Error(`No product IDs on ${category.id} page ${page}.`);
      const now = new Date();
      const titleKeys = ids.map((pid) => normalizeTitle(byId.get(pid)?.nameEn || byId.get(pid)?.productNameEn));
      const existingCandidates = await collection.find({
        countryCode: COUNTRY_CODE, status: "candidate",
        titleKey: { $in: titleKeys.filter((title) => title.length >= 18) },
      }, { projection: { titleKey: 1, pid: 1 } }).toArray();
      const titlesOnPage = new Map(existingCandidates.map((item) => [item.titleKey, String(item.pid)]));
      const newIds = ids.filter((pid) => !existingPids.has(pid));
      const possibleDuplicates = new Set();
      for (const pid of newIds) {
        const title = normalizeTitle(byId.get(pid)?.nameEn || byId.get(pid)?.productNameEn);
        if (title.length < 18) continue;
        if (existingTitles.has(title) || (titlesOnPage.has(title) && titlesOnPage.get(title) !== pid)) possibleDuplicates.add(pid);
        else titlesOnPage.set(title, pid);
      }
      if (newIds.length) {
        // Bulk upserts complete before the checkpoint advances. A crash may replay a page safely.
        const operations = newIds.map((pid) => ({
          updateOne: {
            filter: { countryCode: COUNTRY_CODE, pid },
            update: {
              $set: {
                categoryId: category.id, categoryLabel: category.label, seenAt: now,
                title: String(byId.get(pid)?.nameEn || byId.get(pid)?.productNameEn || "").slice(0, 260),
                titleKey: normalizeTitle(byId.get(pid)?.nameEn || byId.get(pid)?.productNameEn),
                imageUrl: String(byId.get(pid)?.bigImage || byId.get(pid)?.productImage || "").slice(0, 2048),
                listedNum: Math.max(0, Number(byId.get(pid)?.listedNum) || 0),
                // CJ listing count is a weak interest proxy, not verified order volume.
                demandSignal: "cj-listed-count",
                // List filtering is only a discovery signal; variant stock and destination shipping
                // must be checked again before any separate publication workflow.
                stockSignal: "cj-list-filter-cn",
                status: possibleDuplicates.has(pid) ? "possible_duplicate" : "candidate",
              },
              $setOnInsert: { countryCode: COUNTRY_CODE, pid, firstSeenAt: now },
            },
            upsert: true,
          },
        }));
        const result = await collection.bulkWrite(operations, { ordered: false });
        if (result.hasWriteErrors?.() || result.getWriteErrors?.().length) {
          throw new Error(`Candidate write failed at ${category.id} page ${page}; checkpoint unchanged.`);
        }
      }
      const totalPages = Number(data.totalPages);
      if (!Number.isFinite(totalPages) || totalPages < 0) {
        throw new Error(`Invalid CJ page count at ${category.id} page ${page}; checkpoint unchanged.`);
      }
      state.currentCategoryId = category.id;
      state.nextPage = page + 1;
      state.pagesProcessed += 1;
      state.candidatesSeen += newIds.length - possibleDuplicates.size;
      await checkpointWrite(state);
      pagesThisRun += 1;
      console.log(`${category.label}: page ${page}/${totalPages}, ${newIds.length - possibleDuplicates.size} new candidates, ${ids.length - newIds.length} existing IDs excluded, ${possibleDuplicates.size} title matches held for review, total unique ${await collection.countDocuments({ countryCode: COUNTRY_CODE, status: "candidate" })}`);
      if (page >= 1000 && totalPages > 1000) {
        throw new Error(`CJ reports ${totalPages} pages for ${category.id}; 1000-page API ceiling needs a narrower query. Checkpoint saved at page ${state.nextPage}.`);
      }
      if (!products.length || page >= totalPages || products.length < PAGE_SIZE) {
        finished = true;
        break;
      }
      page += 1;
    }

    if (!finished) {
      console.log(`Paused at ${category.label} page ${state.nextPage}; run again to continue.`);
      break;
    }
    completed.add(category.id);
    state.completedCategoryIds = [...completed];
    state.currentCategoryId = "";
    state.nextPage = 1;
    await checkpointWrite(state);
  }
  state.completed = categories.every((category) => completed.has(category.id));
  await checkpointWrite(state);
  console.log(`Discovery ${state.completed ? "complete" : "paused"}: ${completed.size}/${categories.length} categories; ${await collection.countDocuments({ countryCode: COUNTRY_CODE, status: "candidate" })} unique candidates.`);
  if (state.completed && state.candidatesSeen === 0) {
    console.warn("CJ returned zero candidates; verify filters and account access.");
  }
}

try { await run(); }
catch (error) { console.error("CJ discovery stopped without advancing the failed page:", error); process.exitCode = 1; }
finally { await disconnectDatabase(); }
