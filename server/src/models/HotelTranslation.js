import mongoose from "mongoose";

const hotelTranslationSchema = new mongoose.Schema(
  {
    hotelId: { type: String, required: true, unique: true, trim: true, index: true },
    sourceHash: { type: String, required: true, trim: true, index: true },
    sourceLanguage: { type: String, default: "en", trim: true },
    translations: { type: mongoose.Schema.Types.Mixed, default: {} },
    model: { type: String, trim: true, default: "" },
  },
  { timestamps: true, versionKey: false },
);

export const HotelTranslation = mongoose.model(
  "HotelTranslation",
  hotelTranslationSchema,
);
