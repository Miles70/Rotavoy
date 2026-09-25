import mongoose from "mongoose";

const personSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true, default: "" },
    occupancyNumber: { type: Number, min: 1, max: 8, default: null },
  },
  { _id: false },
);

const travelBookingSchema = new mongoose.Schema(
  {
    clientReference: { type: String, required: true, unique: true, index: true },
    offerId: { type: String, required: true, trim: true },
    prebookId: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: ["awaiting_payment", "processing", "confirmed", "failed", "expired"],
      default: "awaiting_payment",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed"],
      default: "unpaid",
      index: true,
    },
    payment: { type: mongoose.Schema.Types.Mixed, default: {} },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, trim: true, uppercase: true },
    paymentExpiresAt: { type: Date, default: null, index: true },
    holder: { type: personSchema, required: true },
    guests: { type: [personSchema], required: true },
    providerBooking: { type: mongoose.Schema.Types.Mixed, default: {} },
    failureReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true, versionKey: false },
);

travelBookingSchema.index(
  { "payment.transactionHash": 1 },
  {
    unique: true,
    partialFilterExpression: { "payment.transactionHash": { $type: "string", $gt: "" } },
  },
);

export const TravelBooking = mongoose.model("TravelBooking", travelBookingSchema);
