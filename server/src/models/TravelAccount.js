import mongoose from 'mongoose';
const favorite = new mongoose.Schema({ hotelId: { type: String, required: true }, name: String, image: String }, { _id: false });
const traveler = new mongoose.Schema({ firstName: String, lastName: String, email: String, phone: String });
export const TravelAccount = mongoose.model('TravelAccount', new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
  favorites: { type: [favorite], default: [] }, travelers: { type: [traveler], default: [] },
}, { timestamps: true, versionKey: false }));
