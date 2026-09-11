import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    country: { type: String, trim: true, default: "" },
    countryCode: { type: String, trim: true, uppercase: true, default: "" },
    province: { type: String, trim: true, default: "" },
    city: { type: String, required: true, trim: true },
    postalCode: { type: String, trim: true, default: "" },
    address: { type: String, required: true, trim: true },
    note: { type: String, trim: true, default: "" },
  },
  { _id: false },
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
    supplier: { type: String, trim: true, default: "" },
    supplierProductId: { type: String, trim: true, default: "" },
    supplierVariantId: { type: String, trim: true, default: "" },
    supplierSku: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const paymentSchema = new mongoose.Schema(
  {
    configured: { type: Boolean, default: false },
    provider: {
      type: String,
      enum: ["none", "onchain", "stripe"],
      default: "none",
    },
    network: { type: String, trim: true, default: "" },
    chainId: { type: Number, min: 1, default: null },
    token: { type: String, trim: true, uppercase: true, default: "" },
    tokenAddress: { type: String, trim: true, lowercase: true, default: "" },
    tokenDecimals: { type: Number, min: 0, max: 36, default: null },
    payerAddress: { type: String, trim: true, lowercase: true, default: "" },
    recipientAddress: { type: String, trim: true, lowercase: true, default: "" },
    transactionHash: { type: String, trim: true, lowercase: true, default: "" },
    expectedAmount: { type: String, trim: true, default: "" },
    amount: { type: String, trim: true, default: "" },
    currency: { type: String, trim: true, uppercase: true, default: "" },
    blockNumber: { type: Number, min: 0, default: null },
    confirmations: { type: Number, min: 0, default: 0 },
    confirmedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    failureReason: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "awaiting_payment",
        "pending",
        "processing",
        "shipped",
        "delivered",
        "completed",
        "cancelled",
        "expired",
      ],
      default: "awaiting_payment",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed", "refunded"],
      default: "unpaid",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["not_selected", "card", "crypto"],
      default: "not_selected",
    },
    payment: {
      type: paymentSchema,
      default: () => ({}),
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
    logistics: { type: mongoose.Schema.Types.Mixed, default: {} },
    fulfillment: { type: mongoose.Schema.Types.Mixed, default: {} },
    reservationExpiresAt: { type: Date, default: null, index: true },
    stockReserved: { type: Boolean, default: false, index: true },
    stockReleasedAt: { type: Date, default: null },
    stockCommittedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

orderSchema.index(
  { "payment.transactionHash": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "payment.transactionHash": { $type: "string", $gt: "" },
    },
  },
);

export const Order = mongoose.model("Order", orderSchema);
