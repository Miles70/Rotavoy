import mongoose from 'mongoose';
import { TravelAdminSettings } from '../models/TravelAdmin.js';
export function resolveTravelMargin(settings = {}) {
  const value = settings.marginPercent ?? Number(process.env.NUITEE_DEFAULT_MARGIN_PERCENT || 15);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : 15;
}
export async function readTravelMargin() {
  const settings = mongoose.connection.readyState === 1 ? await TravelAdminSettings.findOne({ key: 'travel' }).select('marginPercent').lean() : null;
  return resolveTravelMargin(settings || {});
}
