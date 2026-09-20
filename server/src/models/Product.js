import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    sourceLanguage: { type: String, trim: true, default: "en" },
    sourceHash: { type: String, trim: true, default: "", index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    features: { type: [String], default: [] },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    supplierContent: { type: mongoose.Schema.Types.Mixed, default: {} },
    contentMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
    translations: { type: mongoose.Schema.Types.Mixed, default: {} },
    translationMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
    brand: { type: String, trim: true, default: "", index: true },
    quantity: { type: String, trim: true, default: "" },
    categoryKey: { type: String, required: true, trim: true, index: true },
    categoryLabel: { type: String, trim: true, default: "" },
    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, min: 0, default: null },
    currency: { type: String, trim: true, uppercase: true, default: "USD" },
    costPrice: { type: Number, min: 0, default: null },
    badge: { type: String, enum: ["sale", "new", "stock", null], default: null },
    image: { type: String, default: "🛍️" },
    imageUrl: { type: String, default: "" },
    images: { type: [String], default: [] },
    videoUrl: { type: String, default: "" },
    videoPosterUrl: { type: String, default: "" },
    hasVideo: { type: Boolean, default: false, index: true },
    stock: { type: Number, min: 0, default: 0 },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, min: 0, default: 0 },
    popularity: { type: Number, min: 0, default: 0, index: true },
    source: { type: String, trim: true, default: "manual", index: true },
    sourceType: { type: String, trim: true, default: "", index: true },
    sourceCode: { type: String, trim: true, default: "" },
    sourceUrl: { type: String, trim: true, default: "" },
    supplier: { type: String, trim: true, default: "", index: true },
    supplierProductId: { type: String, trim: true, default: "", index: true },
    supplierVariantId: { type: String, trim: true, default: "", index: true },
    variantGroupKey: { type: String, trim: true, default: "", index: true },
    sharedContentOwner: { type: Boolean, default: false },
    supplierSku: { type: String, trim: true, default: "", index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

productSchema.index({ source: 1, supplierProductId: 1, isActive: 1 });
productSchema.index({ source: 1, "contentMeta.status": 1, supplierProductId: 1 });
productSchema.index({ source: 1, isActive: 1, categoryKey: 1, stock: 1 });
productSchema.index({ source: 1, isActive: 1, stock: 1 });

export const Product = mongoose.model("Product", productSchema);
