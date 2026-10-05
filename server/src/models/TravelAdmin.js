import mongoose from 'mongoose';
const options = { timestamps: true, versionKey: false };
export const TravelAdminSettings = mongoose.model('TravelAdminSettings', new mongoose.Schema({
  key: { type: String, unique: true, default: 'travel' },
  marginPercent: { type: Number, default: null, min: 0, max: 100 },
  supportEmail: { type: String, default: '' },
  supportPhone: { type: String, default: '' },
  announcement: { type: String, default: '' },
}, options));
export const TravelSupportTicket = mongoose.model('TravelSupportTicket', new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", index: true },
  message: { type: String, default: "" }, reply: { type: String, default: "" },
  subject: { type: String, required: true }, email: { type: String, default: '' }, clientReference: { type: String, default: '', index: true },
  type: { type: String, enum: ['support', 'cancellation', 'refund', 'payment', 'provider'], default: 'support' },
  status: { type: String, enum: ['open', 'in_progress', 'waiting_provider', 'resolved'], default: 'open', index: true },
  priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
  note: { type: String, default: '' }, createdBy: String,
}, options));
export const TravelContent = mongoose.model('TravelContent', new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['destination', 'campaign', 'guide'], default: 'destination' },
  destination: { type: String, default: '' }, body: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'ready', 'archived'], default: 'draft' },
}, options));
export const TravelBookingNote = mongoose.model('TravelBookingNote', new mongoose.Schema({
  clientReference: { type: String, unique: true, required: true }, note: { type: String, default: '' },
}, options));
export const TravelAdminAudit = mongoose.model('TravelAdminAudit', new mongoose.Schema({
  actor: String, action: String, target: String,
}, options));
