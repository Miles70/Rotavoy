import mongoose from 'mongoose';
export const inquiryStatuses = ['new', 'contacted', 'quoted', 'closed'];
const schema = new mongoose.Schema({
 reference: { type: String, required: true, unique: true },
 kind: { type: String, enum: ['hotel', 'flight', 'cars', 'activities'], required: true },
 name: { type: String, required: true }, email: { type: String, required: true }, phone: String,
 destination: { type: String, required: true }, hotelId: String, origin: String,
 startDate: { type: String, required: true }, endDate: String,
 adults: { type: Number, min: 1, max: 20, required: true }, children: { type: Number, min: 0, max: 20, default: 0 },
 notes: String, status: { type: String, enum: inquiryStatuses, default: 'new', index: true }
}, { timestamps: true, versionKey: false });
export const TravelInquiry = mongoose.model('TravelInquiry', schema);
