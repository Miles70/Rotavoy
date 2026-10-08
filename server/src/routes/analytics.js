import crypto from 'node:crypto';
import { TravelBooking } from '../models/TravelBooking.js';
import { requireBookingAccess } from '../services/bookingAccess.js';
import { classifyTraffic } from '../services/analyticsTraffic.js';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isIP } from 'node:net';
import { optionalCustomer } from '../middleware/customerAuth.js';
import { TravelAnalytics } from '../models/TravelAnalytics.js';
export const analyticsTypes = ['hotel_open', 'page_view', 'hotel_view', 'hotel_search', 'hotel_select', 'room_select', 'flight_search', 'flight_view', 'flight_select', 'category_select', 'checkout_view', 'payment_start', 'payment_ready', 'payment_error', 'booking_confirmation_view', 'heartbeat', 'car_plan', 'activity_plan'];
const fields = ['hotelId', 'hotelName', 'destination', 'origin', 'originName', 'destinationName', 'departure', 'returnDate', 'checkin', 'checkout', 'adults', 'children', 'infants', 'offerId', 'category', 'roomName', 'airline', 'currency', 'paymentMethod'];
const clean = (value, max = 160) => typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) : '';
export function sanitizeAnalytics(body) {
  if (!analyticsTypes.includes(body?.type) || !/^[a-zA-Z0-9_-]{8,100}$/.test(body.visitorId || '') || !/^[a-zA-Z0-9_-]{8,100}$/.test(body.eventId || '') || !/^[a-zA-Z0-9_-]{8,100}$/.test(body.sessionId || '')) return null;
  const path = clean(body.path, 300).split(/[?#]/)[0];
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/admin')) return null;
  let referrer = '';
  try { const url = new URL(body.referrer); if (['https:', 'http:'].includes(url.protocol)) referrer = url.origin; } catch { /* Direct visit. */ }
  return { eventId: body.eventId, visitorId: body.visitorId, sessionId: body.sessionId, type: body.type, path, referrer, source: clean(body.source, 100) || referrer || 'direct', details: Object.fromEntries(fields.filter(key => clean(body.details?.[key])).map(key => [key, clean(body.details[key])])) };
}
const geoCache = new Map();
async function geo(ip) {
  if (!isIP(ip) || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|::1$|f[cd]|fe80)/i.test(ip)) return { country: '', city: '' };
  const cached = geoCache.get(ip);
  if (cached && cached.expires > Date.now()) return cached.value;
  let value = { country: '', city: '' };
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: AbortSignal.timeout(1800) });
    const data = await response.json();
    if (data.success) value = { country: clean(data.country, 80), city: clean(data.city, 80) };
  } catch { /* Location lookup never blocks analytics ingestion. */ }
  if (geoCache.size >= 1000) geoCache.delete(geoCache.keys().next().value);
  geoCache.set(ip, { value, expires: Date.now() + 3600000 }); return value;
}
export const analyticsRouter = Router();
analyticsRouter.use(rateLimit({ windowMs: 60000, limit: 90, standardHeaders: 'draft-8', legacyHeaders: false }));
analyticsRouter.post('/events', optionalCustomer, async (request, response) => {
  const event = sanitizeAnalytics(request.body);
  if (!event) return response.status(400).json({ message: 'Geçersiz analitik olayı.' });
  const ip = clean(request.ip, 80).replace(/^::ffff:/, '');
  const ua = clean(request.get('user-agent'), 500);
  const location = await geo(ip);
  const classification = classifyTraffic(request.body.analyticsProof, ua);
  if (!request.body.analyticsProof && request.body.schemaVersion !== 2) { classification.trafficType = 'unknown'; classification.classificationReason = 'legacy_client'; }
  const entry = { ...event, country: location.country, ...classification,
    customerId: '', identity: '',
    device: /tablet|ipad/i.test(ua) ? 'Tablet' : /mobile|iphone|android/i.test(ua) ? 'Mobil' : 'Masaüstü',
    browser: /edg/i.test(ua) ? 'Edge' : /firefox/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Diğer',
    bot: /bot|crawler|spider|headless/i.test(ua),
  };
  try { await TravelAnalytics.updateOne({ eventId: event.eventId }, { $setOnInsert: entry }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  response.status(204).end();
});

// Read-only booking verification; attribution is stored only in the analytics collection.
// A signed test/admin payment context remains excluded even when the return page opens in another session.
analyticsRouter.post(['/booking-ready', '/booking-confirmed'], optionalCustomer, async (request, response) => {
  const confirmation = request.path === '/booking-confirmed';
  const event = sanitizeAnalytics({ ...request.body, type: confirmation ? 'booking_confirmation_view' : 'payment_ready' });
  const reference = clean(request.body.bookingReference, 120);
  if (!event || !reference) return response.status(400).json({ message: 'Geçersiz analitik olayı.' });
  const booking = await TravelBooking.findOne({ clientReference: reference });
  if (!booking) return response.status(404).json({ message: 'Rezervasyon bulunamadı.' });
  requireBookingAccess(request, booking);
  if (confirmation && booking.status !== 'confirmed') return response.status(204).end();
  const key = crypto.createHash('sha256').update(reference).digest('hex');
  const eventId = `${confirmation ? 'confirmed' : 'ready'}-${key}`;
  const context = await TravelAnalytics.findOne({ visitorId: event.visitorId, sessionId: event.sessionId, type: { $ne: 'booking_confirmed' } }).sort({ createdAt: -1 }).select('country device browser source').lean();
  const traffic = classifyTraffic(request.body.analyticsProof, clean(request.get('user-agent'), 500));
  let attribution = { ...event, ...(context ? { country: context.country, device: context.device, browser: context.browser, source: context.source } : {}), ...traffic };
  if (confirmation) {
    const binding = await TravelAnalytics.findOne({ eventId: `ready-${key}` }).lean();
    if (binding) {
      for (const field of ['visitorId', 'sessionId', 'country', 'device', 'browser', 'source', 'trafficType', 'classificationReason']) attribution[field] = binding[field];
    } else if (traffic.trafficType === 'visitor') {
      attribution.trafficType = 'unknown'; attribution.classificationReason = 'missing_booking_attribution';
    }
  }
  const entry = { ...attribution, eventId, type: confirmation ? 'booking_confirmed' : 'payment_ready', details: { hotelId: booking.stay?.hotelId || '', hotelName: booking.stay?.hotelName || '', category: booking.kind || 'hotel' } };
  try { await TravelAnalytics.updateOne({ eventId }, { $setOnInsert: entry }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  response.status(204).end();
});
