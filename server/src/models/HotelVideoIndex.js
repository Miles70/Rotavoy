import mongoose from "mongoose";

const hotelVideoIndexSchema = new mongoose.Schema(
  {
    hotelId: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, trim: true, default: "" },
    cityName: { type: String, trim: true, default: "", index: true },
    countryCode: { type: String, trim: true, uppercase: true, default: "", index: true },
    stars: { type: Number, default: 0, index: true },
    mainPhoto: { type: String, trim: true, default: "" },
    videoUrl: { type: String, trim: true, default: "" },
    hasVideo: { type: Boolean, default: false, index: true },
    showcaseVisible: { type: Boolean, default: true, index: true },
    showcasePriority: { type: Number, default: 0, min: 0, max: 100 },
    checkedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false },
);

hotelVideoIndexSchema.index({ hasVideo: 1, stars: -1, checkedAt: -1 });

export const HotelVideoIndex = mongoose.model("HotelVideoIndex", hotelVideoIndexSchema);
