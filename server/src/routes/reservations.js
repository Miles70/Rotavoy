import { Router } from 'express';
import { optionalCustomer } from '../middleware/customerAuth.js';
import { TravelBooking } from '../models/TravelBooking.js';
import { requireBookingAccess } from '../services/bookingAccess.js';
import { bookingPayload, refreshBooking } from '../services/finalizeBooking.js';
export const reservationsRouter = Router();
reservationsRouter.get('/:reference', optionalCustomer, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const booking = await TravelBooking.findOne({ clientReference: String(req.params.reference).slice(0, 120) });
  if (!booking) return res.status(404).json({ message: 'Rezervasyon bulunamadı.' });
  requireBookingAccess(req, booking);
  let current = booking;
  try { current = await refreshBooking(booking); } catch { /* Retain last known state when provider is temporarily unavailable. */ }
  res.json({ booking: bookingPayload(current) });
});
