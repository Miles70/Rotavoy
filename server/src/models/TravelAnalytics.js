import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  visitorId: { type: String, required: true }, sessionId: String,
  type: { type: String, required: true }, path: String, referrer: String, source: String,
  customerId: String, identity: String, ip: String, country: String, city: String,
  device: String, browser: String, bot: Boolean,
  details: { type: Map, of: String },
}, { timestamps: true });
schema.index({ createdAt: -1 });
schema.index({ visitorId: 1, createdAt: -1 });
schema.index({ type: 1, createdAt: -1 });
export const TravelAnalytics = mongoose.model('TravelAnalytics', schema);
