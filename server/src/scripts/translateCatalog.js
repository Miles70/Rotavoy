import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { Product } from "../models/Product.js";
import {
  CATALOG_TRANSLATION_SCHEMA_VERSION,
  TRANSLATABLE_CATALOG_LANGUAGES,
  calculateProductSourceHash,
  normalizeCatalogLanguage,
  translateCatalogProductDocument,
} from "../services/catalogTranslation.js";

function parseArguments(argv) {
  const options = {
    languages: [...TRANSLATABLE_CATALOG_LANGUAGES],
    limit: 25,
    concurrency: Math.max(
      1,
      Number(process.env.CATALOG_TRANSLATION_CONCURRENCY || 1)
    ),
    delayMs: Math.max(
      0,
      Number(process.env.CATALOG_TRANSLATION_DELAY_MS || 150)
    ),
    force: false,
    statusOnly: false,
    productKey: "",
  };

  for (const argument of argv) {
    if (argument === "--force") options.force = true;
    else if (argument === "--status") options.statusOnly = true;
    else if (argument.startsWith("--limit=")) {
      options.limit = Math.max(1, Number(argument.split("=")[1]) || 25);
    } else if (argument.startsWith("--concurrency=")) {
      options.concurrency = Math.max(
        1,
        Number(argument.split("=")[1]) || 1
      );
    } else if (argument.startsWith("--delay=")) {
      options.delayMs = Math.max(0, Number(argument.split("=")[1]) || 0);
    } else if (argument.startsWith("--product=")) {
      options.productKey = argument.slice("--product=".length).trim();
    } else if (argument.startsWith("--languages=")) {
      options.languages = argument
        .slice("--languages=".length)
        .split(",")
        .map(normalizeCatalogLanguage)
        .filter((language) =>
          TRANSLATABLE_CATALOG_LANGUAGES.includes(language)
        );
    }
  }

  options.languages = [...new Set(options.languages)];
  if (options.languages.length === 0) {
    throw new Error("No supported target language was selected.");
  }

  return options;
}

function wait(milliseconds) {
  if (!milliseconds) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isTranslationReady(product, language, sourceHash) {
  const translation = product.translations?.[language];
  const meta = product.translationMeta?.[language];

  return Boolean(
    translation?.title &&
      meta?.status === "ready" &&
      meta?.sourceHash === sourceHash &&
      Number(meta?.schemaVersion) === CATALOG_TRANSLATION_SCHEMA_VERSION
  );
}

async function showStatus(languages) {
  const products = await Product.find({ isActive: true })
    .select(
      "sourceLanguage sourceHash title description categoryLabel brand features details translations translationMeta"
    )
    .lean();

  console.log(`Active products: ${products.length}`);

  for (const language of languages) {
    const counts = {
      ready: 0,
      missing: 0,
      processing: 0,
      failed: 0,
      stale: 0,
    };

    for (const product of products) {
      const sourceHash = calculateProductSourceHash(product);
      const meta = product.translationMeta?.[language];

      if (isTranslationReady(product, language, sourceHash)) {
        counts.ready += 1;
      } else if (meta?.status === "processing") {
        counts.processing += 1;
      } else if (meta?.status === "failed") {
        counts.failed += 1;
      } else if (product.translations?.[language]?.title) {
        counts.stale += 1;
      } else {
        counts.missing += 1;
      }
    }

    console.log(
      `${language}: ready=${counts.ready} missing=${counts.missing} stale=${counts.stale} failed=${counts.failed} processing=${counts.processing}`
    );
  }
}

async function mapWithConcurrency(values, worker, concurrency) {
  const results = new Array(values.length);
  let cursor = 0;

  async function run() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      () => run()
    )
  );

  return results;
}

async function translateProduct(product, options, position, total) {
  const sourceHash = calculateProductSourceHash(product.toObject());

  if (product.sourceHash !== sourceHash) {
    product.sourceLanguage = "en";
    product.sourceHash = sourceHash;
    await product.save();
  }

  for (const language of options.languages) {
    if (
      !options.force &&
      isTranslationReady(product.toObject(), language, sourceHash)
    ) {
      console.log(
        `[${position + 1}/${total}] ${product.key} ${language}: ready, skipped`
      );
      continue;
    }

    try {
      const result = await translateCatalogProductDocument(
        product,
        language,
        { force: options.force }
      );
      console.log(
        `[${position + 1}/${total}] ${product.key} ${language}: ${result.status}`
      );
    } catch (error) {
      console.error(
        `[${position + 1}/${total}] ${product.key} ${language}: failed - ${error.message}`
      );
    }

    await wait(options.delayMs);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  await connectDatabase();

  if (options.statusOnly) {
    await showStatus(options.languages);
    return;
  }

  const filter = { isActive: true };
  if (options.productKey) filter.key = options.productKey;

  const products = await Product.find(filter)
    .sort({ popularity: -1, _id: 1 })
    .limit(options.productKey ? 1 : options.limit);

  if (products.length === 0) {
    throw new Error("No active products matched the translation request.");
  }

  console.log(
    `Catalog translation started: products=${products.length}, languages=${options.languages.join(",")}, concurrency=${options.concurrency}, force=${options.force}`
  );

  await mapWithConcurrency(
    products,
    (product, index) =>
      translateProduct(product, options, index, products.length),
    options.concurrency
  );

  await showStatus(options.languages);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => {});
  });
