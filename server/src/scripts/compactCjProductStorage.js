import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { Product } from "../models/Product.js";
import {
  chooseSharedContentOwner,
  compactVariantSupplierContent,
  compactVariantTranslations,
} from "../services/cjProductStorage.js";

const MB = 1024 * 1024;
const BATCH_SIZE = 500;

function mb(value) {
  return (Number(value || 0) / MB).toFixed(2);
}

function compactImages(product) {
  const imageUrl = String(product?.imageUrl || "").trim();
  return imageUrl ? [imageUrl] : [];
}

async function flush(operations) {
  if (!operations.length) return 0;
  const result = await Product.bulkWrite(operations, { ordered: false });
  operations.length = 0;
  return Number(result.modifiedCount || 0);
}

async function logicalSize() {
  const stats = await mongoose.connection.db.command({ collStats: "products" });
  return Number(stats.size || 0);
}

try {
  await connectDatabase();

  const before = await logicalSize();
  const parents = await Product.aggregate([
    {
      $match: {
        source: "cj",
        supplierProductId: { $type: "string", $ne: "" },
      },
    },
    {
      $group: {
        _id: "$supplierProductId",
        variants: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).allowDiskUse(true);

  console.log(`Compacting ${parents.length.toLocaleString("en-US")} CJ parent products.`);
  console.log("Product keys, prices, stock, supplier IDs and URLs are preserved.");

  const operations = [];
  let modified = 0;
  let compactedSiblings = 0;
  let ownersMarked = 0;
  let processedParents = 0;

  for (const parent of parents) {
    const products = await Product.find({
      source: "cj",
      supplierProductId: parent._id,
    })
      .select({
        _id: 1,
        key: 1,
        supplierVariantId: 1,
        isActive: 1,
        sharedContentOwner: 1,
        description: 1,
        features: 1,
        imageUrl: 1,
        images: 1,
        videoUrl: 1,
        videoPosterUrl: 1,
        supplierContent: 1,
        translations: 1,
        contentMeta: 1,
      })
      .lean();

    const owner = chooseSharedContentOwner(products);
    if (!owner) continue;

    for (const product of products) {
      const isOwner = String(product._id) === String(owner._id);

      if (isOwner) {
        if (!product.sharedContentOwner) {
          operations.push({
            updateOne: {
              filter: { _id: product._id },
              update: { $set: { sharedContentOwner: true } },
            },
          });
          ownersMarked += 1;
        }
        continue;
      }

      operations.push({
        updateOne: {
          filter: { _id: product._id },
          update: {
            $set: {
              sharedContentOwner: false,
              description: "",
              features: [],
              images: compactImages(product),
              videoUrl: "",
              videoPosterUrl: "",
              supplierContent: compactVariantSupplierContent(product.supplierContent),
              translations: compactVariantTranslations(product.translations),
            },
          },
        },
      });
      compactedSiblings += 1;

      if (operations.length >= BATCH_SIZE) {
        modified += await flush(operations);
      }
    }

    processedParents += 1;
    if (processedParents % 250 === 0) {
      console.log(
        `Progress: ${processedParents.toLocaleString("en-US")}/${parents.length.toLocaleString("en-US")} parents; ${compactedSiblings.toLocaleString("en-US")} sibling variants compacted.`,
      );
    }
  }

  modified += await flush(operations);

  const after = await logicalSize();
  console.log("\nCJ product compaction complete.");
  console.log(`Parents processed: ${processedParents.toLocaleString("en-US")}`);
  console.log(`Shared content owners marked: ${ownersMarked.toLocaleString("en-US")}`);
  console.log(`Sibling variants compacted: ${compactedSiblings.toLocaleString("en-US")}`);
  console.log(`Documents modified: ${modified.toLocaleString("en-US")}`);
  console.log(`Products logical size: ${mb(before)} MB -> ${mb(after)} MB`);
  console.log(`Logical size reclaimed: ${mb(Math.max(before - after, 0))} MB`);
} catch (error) {
  console.error("CJ product compaction failed:", error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
