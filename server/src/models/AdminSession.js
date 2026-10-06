import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  credentialVersion: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const AdminSession = mongoose.model('AdminSession', schema);
