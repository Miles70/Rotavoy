import mongoose from "mongoose";

const homeCampaignSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "home-main" },
    active: { type: Boolean, default: true },
    eyebrow: { type: String, trim: true, default: "LIMITED-TIME DROP" },
    title: { type: String, trim: true, default: "Big finds. Better prices." },
    description: {
      type: String,
      trim: true,
      default: "Discover popular products picked for this week's Rotavoy campaign.",
    },
    buttonLabel: { type: String, trim: true, default: "Shop now" },
    buttonUrl: { type: String, trim: true, default: "/products" },
    backgroundImageUrl: { type: String, trim: true, default: "" },
    productKeys: { type: [String], default: [] },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

export const HomeCampaign = mongoose.model("HomeCampaign", homeCampaignSchema);
