import mongoose from "mongoose";

const customerAuthChallengeSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["wallet"],
      required: true,
    },
    identifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    nonce: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    usedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

customerAuthChallengeSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

export const CustomerAuthChallenge = mongoose.model(
  "CustomerAuthChallenge",
  customerAuthChallengeSchema,
);
