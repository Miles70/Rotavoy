import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { HomeCampaign } from "../models/HomeCampaign.js";
import { Product } from "../models/Product.js";

const CAMPAIGN_KEY = "home-main";
const MAX_PRODUCT_KEYS = 3;
const MAX_CATEGORY_SLIDES = 3;

const defaults = {
  key: CAMPAIGN_KEY,
  active: true,
  eyebrow: "LIMITED-TIME DROP",
  title: "Big finds. Better prices.",
  description: "Discover popular products picked for this week's Masterota campaign.",
  buttonLabel: "Shop now",
  buttonUrl: "/products",
  backgroundImageUrl: "",
  productKeys: [],
  startsAt: null,
  endsAt: null,
};

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeLink(value, fallback = "") {
  const link = cleanText(value, 500);
  if (!link) return fallback;

  if (link.startsWith("/") || /^https?:\/\//i.test(link)) {
    return link;
  }

  throw createHttpError("Links must start with /, http:// or https://.", 400);
}

function normalizeDate(value, fieldName) {
  if (value === null || value === "") return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(`${fieldName} must be a valid date.`, 400);
  }

  return date;
}

function formatCategoryLabel(value) {
  const label = cleanText(value, 90);
  if (!label) return "Trending picks";

  return label
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function getCampaign() {
  return HomeCampaign.findOneAndUpdate(
    { key: CAMPAIGN_KEY },
    { $setOnInsert: defaults },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

async function getCampaignProducts(productKeys = []) {
  const keys = productKeys.filter(Boolean).slice(0, MAX_PRODUCT_KEYS);

  if (keys.length > 0) {
    const products = await Product.find({ key: { $in: keys }, isActive: true }).lean();
    const byKey = new Map(products.map((product) => [product.key, product]));
    return keys.map((key) => byKey.get(key)).filter(Boolean);
  }

  return Product.find({
    isActive: true,
    $or: [{ imageUrl: { $ne: "" } }, { images: { $exists: true, $ne: [] } }],
  })
    .sort({ popularity: -1, createdAt: -1 })
    .limit(MAX_PRODUCT_KEYS)
    .lean();
}

async function getCategorySlides(excludedProductKeys = []) {
  const categoryGroups = await Product.aggregate([
    {
      $match: {
        isActive: true,
        categoryKey: { $nin: ["", null] },
        $or: [{ imageUrl: { $ne: "" } }, { images: { $exists: true, $ne: [] } }],
      },
    },
    {
      $group: {
        _id: "$categoryKey",
        label: { $first: "$categoryLabel" },
        count: { $sum: 1 },
        popularity: { $sum: { $ifNull: ["$popularity", 0] } },
      },
    },
    { $sort: { popularity: -1, count: -1, _id: 1 } },
    { $limit: 12 },
  ]);

  const slides = [];
  const usedProductKeys = new Set(excludedProductKeys);
  const themes = ["electric", "sunset", "midnight"];

  for (const category of categoryGroups) {
    if (slides.length >= MAX_CATEGORY_SLIDES) break;

    const products = await Product.find({
      isActive: true,
      categoryKey: category._id,
      key: { $nin: [...usedProductKeys] },
      $or: [{ imageUrl: { $ne: "" } }, { images: { $exists: true, $ne: [] } }],
    })
      .sort({ popularity: -1, rating: -1, createdAt: -1 })
      .limit(MAX_PRODUCT_KEYS)
      .lean();

    if (products.length === 0) continue;

    products.forEach((product) => usedProductKeys.add(product.key));

    const categoryLabel = formatCategoryLabel(category.label || category._id);
    const heroImage = products[0]?.imageUrl || products[0]?.images?.[0] || "";

    slides.push({
      id: `category-${category._id}`,
      theme: themes[slides.length % themes.length],
      eyebrow: "CATEGORY SPOTLIGHT",
      title: categoryLabel,
      description: `Fresh ${categoryLabel.toLowerCase()} picks selected from the Masterota catalog.`,
      buttonLabel: "Shop category",
      buttonUrl: `/products?category=${encodeURIComponent(category._id)}`,
      backgroundImageUrl: heroImage,
      products: products.map(serializeProduct),
    });
  }

  return slides;
}

function serializeProduct(product) {
  return {
    key: product.key,
    title: product.title,
    price: product.price,
    oldPrice: product.oldPrice,
    currency: "USD",
    image: product.image,
    imageUrl: product.imageUrl || product.images?.[0] || "",
  };
}

function isCampaignVisible(campaign) {
  if (!campaign.active) return false;

  const now = Date.now();
  if (campaign.startsAt && new Date(campaign.startsAt).getTime() > now) return false;
  if (campaign.endsAt && new Date(campaign.endsAt).getTime() < now) return false;
  return true;
}

async function serializeCampaign(campaign) {
  const products = await getCampaignProducts(campaign.productKeys || []);
  const serializedProducts = products.map(serializeProduct);
  const categorySlides = await getCategorySlides(products.map((product) => product.key));

  const mainSlide = {
    id: "main-campaign",
    theme: "signature",
    eyebrow: campaign.eyebrow,
    title: campaign.title,
    description: campaign.description,
    buttonLabel: campaign.buttonLabel,
    buttonUrl: campaign.buttonUrl,
    backgroundImageUrl: campaign.backgroundImageUrl,
    products: serializedProducts,
  };

  return {
    ...campaign,
    products: serializedProducts,
    slides: [mainSlide, ...categorySlides],
    slideIntervalMs: 5500,
  };
}

export const homeCampaignRouter = Router();
export const adminHomeCampaignRouter = Router();

homeCampaignRouter.get("/", async (request, response, next) => {
  try {
    const campaign = await getCampaign();

    if (!isCampaignVisible(campaign)) {
      return response.json({ campaign: null });
    }

    return response.json({ campaign: await serializeCampaign(campaign) });
  } catch (error) {
    return next(error);
  }
});

adminHomeCampaignRouter.use(requireAdmin);

adminHomeCampaignRouter.get("/", async (request, response, next) => {
  try {
    const campaign = await getCampaign();
    return response.json({ campaign: await serializeCampaign(campaign) });
  } catch (error) {
    return next(error);
  }
});

adminHomeCampaignRouter.patch("/", async (request, response, next) => {
  try {
    const body = request.body || {};
    const updates = {};

    if (body.active !== undefined) updates.active = Boolean(body.active);
    if (body.eyebrow !== undefined) updates.eyebrow = cleanText(body.eyebrow, 80);
    if (body.title !== undefined) updates.title = cleanText(body.title, 140);
    if (body.description !== undefined) updates.description = cleanText(body.description, 320);
    if (body.buttonLabel !== undefined) updates.buttonLabel = cleanText(body.buttonLabel, 60);
    if (body.buttonUrl !== undefined) updates.buttonUrl = normalizeLink(body.buttonUrl, "/products");
    if (body.backgroundImageUrl !== undefined) {
      updates.backgroundImageUrl = normalizeLink(body.backgroundImageUrl, "");
    }

    if (body.productKeys !== undefined) {
      if (!Array.isArray(body.productKeys)) {
        throw createHttpError("productKeys must be an array.", 400);
      }

      updates.productKeys = [
        ...new Set(body.productKeys.map((key) => cleanText(key, 100)).filter(Boolean)),
      ].slice(0, MAX_PRODUCT_KEYS);
    }

    if (body.startsAt !== undefined) updates.startsAt = normalizeDate(body.startsAt, "startsAt");
    if (body.endsAt !== undefined) updates.endsAt = normalizeDate(body.endsAt, "endsAt");

    const current = await getCampaign();
    const startsAt = updates.startsAt !== undefined ? updates.startsAt : current.startsAt;
    const endsAt = updates.endsAt !== undefined ? updates.endsAt : current.endsAt;

    if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      throw createHttpError("Campaign end date must be after the start date.", 400);
    }

    const campaign = await HomeCampaign.findOneAndUpdate(
      { key: CAMPAIGN_KEY },
      { $set: updates },
      { new: true, runValidators: true },
    ).lean();

    return response.json({ campaign: await serializeCampaign(campaign) });
  } catch (error) {
    return next(error);
  }
});
