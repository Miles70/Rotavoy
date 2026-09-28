import mongoose from "mongoose";

const customerProfileSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const customerSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["firebase", "wallet", "guest"],
      required: true,
      index: true,
    },
    providerId: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      index: true,
    },
    emailVerified: { type: Boolean, default: false },
    displayName: { type: String, trim: true, default: "" },
    photoUrl: { type: String, trim: true, default: "" },
    profile: {
      type: customerProfileSchema,
      default: () => ({}),
    },
    lastLoginAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

customerSchema.index(
  { provider: 1, providerId: 1 },
  { unique: true },
);

export const Customer = mongoose.model("Customer", customerSchema);
