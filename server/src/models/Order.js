import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    note: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    productKey: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    categoryKey: { type: String, required: true, trim: true },
    image: { type: String, default: "🛍️" },
    imageUrl: { type: String, default: "" },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 10 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed", "refunded"],
      default: "unpaid",
    },
    paymentMethod: {
      type: String,
      enum: ["not_selected", "card", "crypto"],
      default: "not_selected",
    },
    customer: {
      type: customerSchema,
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "Order must contain at least one item.",
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    shipping: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", uppercase: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const Order = mongoose.model("Order", orderSchema);
