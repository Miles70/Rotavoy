import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalCustomer } from '../middleware/customerAuth.js';
import { TravelBooking } from '../models/TravelBooking.js';
import { assertBookingReady, verifyNuiteeFlight, prebookNuiteeFlight } from '../services/nuiteeApi.js';
import { validateFlightPassengers } from '../services/flightPassengers.js';
import { createBookingAccess, requireBookingAccess } from '../services/bookingAccess.js';
import { finalizeBooking, bookingPayload } from '../services/finalizeBooking.js';
export const flightBookingsRouter = Router();
const checkoutLimiter = rateLimit({ windowMs: 600000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

flightBookingsRouter.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const bad = message => Object.assign(new Error(message), { statusCode: 400 });
flightBookingsRouter.post('/checkout', checkoutLimiter, optionalCustomer, async (req, res) => {
  const status = assertBookingReady();
  const offerId = req.body?.offerId;
  if (typeof offerId !== 'string' || !offerId.trim() || offerId.length > 20000) throw bad('Geçerli bir uçuş seç.');
  const verified = await verifyNuiteeFlight(offerId);
  const journey = verified?.data?.[0]?.journey;
  if (!journey?.segments?.length) throw bad('Uçuş artık mevcut değil. Yeniden ara.');
  const { contact, passengers } = validateFlightPassengers(req.body, journey);
  // Require explicit acceptance of the latest verified total before holding a seat.
  const price = journey.pricing?.display;
  if (Number(price?.total) !== Number(req.body.acceptedTotal) || price?.currency !== req.body.acceptedCurrency) return res.status(409).json({ code: 'PRICE_CHANGED', message: 'Uçuş fiyatı güncellendi. Yeni fiyatı kontrol edip tekrar devam et.', total: price?.total, currency: price?.currency });
  const payload = await prebookNuiteeFlight({ offerId, contact, passengers });
  const data = payload?.data?.[0];
  if (!data?.prebookId || !data?.transactionId || !data?.secretKey || !/^pk_(test|live)_/.test(data?.publishableKey || "") || !Number.isFinite(Number(data.price)) || Number(data.price) <= 0 || !/^[A-Z]{3}$/.test(data.currency || '')) throw Object.assign(new Error('Uçuş ödeme oturumu oluşturulamadı.'), { statusCode: 502 });
  if (!data.publishableKey.startsWith(status.environment === "production" ? "pk_live_" : "pk_test_")) throw Object.assign(new Error("Ödeme sağlayıcısı ortamı eşleşmiyor."), { statusCode: 502 });
  const access = createBookingAccess();
  const holder = { firstName: contact.firstName, lastName: contact.lastName, email: contact.email, phone: `+${contact.phoneCountryCode}${contact.phoneNumber}` };
  const booking = await TravelBooking.create({ kind: 'flight', customerId: req.customer?._id || null, accessTokenHash: access.hash, clientReference: `TRV-AIR-${crypto.randomBytes(12).toString('hex').toUpperCase()}`, offerId, prebookId: data.prebookId, holder,
    guests: passengers.map(p => ({ firstName: p.firstName, lastName: p.lastName, email: contact.email })), total: Number(data.price), currency: data.currency, paymentStatus: 'pending',
    flight: { segments: journey.segments, baggage: journey.baggage, terms: journey.terms, providerBookingId: data.booking?.bookingId || "" }, payment: { method: 'card', provider: 'nuitee', transactionId: data.transactionId }, paymentExpiresAt: new Date(Date.now() + 15 * 60000) });
  res.status(201).json({ accessToken: access.token, booking: bookingPayload(booking), paymentSession: { clientReference: booking.clientReference, secretKey: data.secretKey, publishableKey: data.publishableKey || '', amount: Number(data.price), currency: data.currency, environment: status.environment === 'sandbox' ? 'sandbox' : 'live' } });
});
flightBookingsRouter.post('/:reference/finalize', checkoutLimiter, optionalCustomer, async (req, res) => {
  const booking = await TravelBooking.findOne({ clientReference: req.params.reference, kind: 'flight' });
  if (!booking) return res.status(404).json({ message: 'Uçuş rezervasyonu bulunamadı.' });
  requireBookingAccess(req, booking);
  res.json({ booking: bookingPayload(await finalizeBooking(booking)) });
});
