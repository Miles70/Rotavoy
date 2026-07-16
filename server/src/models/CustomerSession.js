import mongoose from "mongoose";

const customerSessionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["firebase", "wallet", "guest"],
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastUsedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

customerSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CustomerSession = mongoose.model(
  "CustomerSession",
  customerSessionSchema,
);
