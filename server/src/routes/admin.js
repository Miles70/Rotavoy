import { reservationSummary } from '../services/bookingState.js';
import { TravelAnalytics } from '../models/TravelAnalytics.js';
import { analyticsTypes } from './analytics.js';
import { readTravelMargin, resolveTravelMargin } from "../services/travelAdminSettings.js";
import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAdmin } from '../middleware/adminAuth.js';
import { TravelBooking } from '../models/TravelBooking.js';
import { Customer } from '../models/Customer.js';
import { HotelVideoIndex } from '../models/HotelVideoIndex.js';
import { TravelAdminSettings, TravelSupportTicket, TravelContent, TravelBookingNote, TravelAdminAudit } from '../models/TravelAdmin.js';
import { getNuiteeStatus } from '../services/nuiteeApi.js';
export const adminRouter = Router();
adminRouter.use((request, response, next) => { response.set('Cache-Control', 'private, no-store'); next(); });
adminRouter.use(...requireAdmin);
const statuses = ['awaiting_payment', 'processing', 'confirmed', 'failed', 'expired'];
function text(value, max = 200) { return String(value || '').trim().slice(0, max); }
function bad(message) { const error = new Error(message); error.statusCode = 400; return error; }
function pagination(query) { return { page: Math.max(1, Math.min(10000, parseInt(query.page, 10) || 1)), limit: Math.max(1, Math.min(100, parseInt(query.limit, 10) || 25)) }; }
function literal(value) { return text(value, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function actor(request) { return request.customer.email || request.customer.providerId; }
async function audit(request, action, target) { await TravelAdminAudit.create({ actor: actor(request), action, target }); }
export function bookingFilters(query) {
  const filter = {};
  if (query.status && statuses.includes(query.status)) filter.status = query.status;
  if (query.paymentStatus && ['unpaid', 'pending', 'paid', 'failed'].includes(query.paymentStatus)) filter.paymentStatus = query.paymentStatus;
  if (query.q) { const regex = new RegExp(literal(query.q), 'i'); filter.$or = [{ clientReference: regex }, { 'holder.email': regex }, { 'holder.firstName': regex }, { 'holder.lastName': regex }, { 'stay.hotelName': regex }]; }
  return filter;
}
export function adminBooking(booking) {
  const payment = booking.payment || {};
  return { kind: booking.kind || "hotel", flight: booking.flight || {}, reservation: reservationSummary(booking.providerBooking, booking.kind), clientReference: booking.clientReference, status: booking.status, paymentStatus: booking.paymentStatus, total: booking.total, currency: booking.currency, stay: booking.stay || {}, holder: booking.holder, guests: booking.guests, createdAt: booking.createdAt, updatedAt: booking.updatedAt, paymentExpiresAt: booking.paymentExpiresAt, failureReason: booking.failureReason,
    payment: { method: payment.method, networkKey: payment.networkKey, chainId: payment.chainId, token: payment.token, transactionHash: payment.transactionHash, expectedAmount: payment.expectedAmount },
    providerReference: text(booking.providerBooking?.data?.bookingId || booking.providerBooking?.bookingId || '', 120) };
}
adminRouter.get('/session', (request, response) => response.json({ admin: { displayName: request.customer.displayName, identity: actor(request) } }));
adminRouter.get('/overview', async (request, response) => {
  const [bookingStatus, totals, customers, tickets, content, hotels] = await Promise.all([
    TravelBooking.aggregate([{ $group: { _id: { status: '$status', paymentStatus: '$paymentStatus' }, count: { $sum: 1 } } }]),
    TravelBooking.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: '$currency', gross: { $sum: '$total' }, count: { $sum: 1 } } }]),
    Customer.countDocuments(), TravelSupportTicket.countDocuments({ status: { $ne: 'resolved' } }), TravelContent.countDocuments(), HotelVideoIndex.countDocuments(),
  ]);
  response.json({ bookingStatus, totals, customers, tickets, content, hotels });
});
adminRouter.get('/bookings', async (request, response) => {
  const { page, limit } = pagination(request.query); const filter = bookingFilters(request.query);
  const [items, total] = await Promise.all([TravelBooking.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), TravelBooking.countDocuments(filter)]);
  response.json({ items: items.map(adminBooking), total, page, limit });
});
adminRouter.get('/bookings/:reference', async (request, response) => {
  const reference = text(request.params.reference, 150);
  const [booking, note] = await Promise.all([TravelBooking.findOne({ clientReference: reference }).lean(), TravelBookingNote.findOne({ clientReference: reference }).lean()]);
  if (!booking) return response.status(404).json({ message: 'Rezervasyon bulunamadı.' });
  response.json({ booking: adminBooking(booking), note: note?.note || '' });
});
adminRouter.put('/bookings/:reference/note', async (request, response) => {
  const reference = text(request.params.reference, 150);
  if (!await TravelBooking.exists({ clientReference: reference })) return response.status(404).json({ message: 'Rezervasyon bulunamadı.' });
  await TravelBookingNote.findOneAndUpdate({ clientReference: reference }, { note: text(request.body.note, 3000) }, { upsert: true, runValidators: true });
  await audit(request, 'booking.note', reference); response.json({ ok: true });
});
adminRouter.get('/customers', async (request, response) => {
  const { page, limit } = pagination(request.query); const regex = new RegExp(literal(request.query.q), 'i');
  const filter = request.query.q ? { $or: [{ email: regex }, { displayName: regex }, { 'profile.fullName': regex }] } : {};
  const [items, total] = await Promise.all([Customer.find(filter).select('displayName email emailVerified provider profile lastLoginAt createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Customer.countDocuments(filter)]);
  response.json({ items, total, page, limit });
});
adminRouter.get('/hotels', async (request, response) => {
  const { page, limit } = pagination(request.query); const regex = new RegExp(literal(request.query.q), 'i');
  const filter = request.query.q ? { $or: [{ name: regex }, { cityName: regex }, { hotelId: regex }] } : {};
  const [items, total] = await Promise.all([HotelVideoIndex.find(filter).sort({ checkedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), HotelVideoIndex.countDocuments(filter)]);
  response.json({ items, total, page, limit });
});
adminRouter.put('/hotels/:hotelId/showcase', async (request, response) => {
  if (typeof request.body.showcaseVisible !== 'boolean' || !Number.isInteger(request.body.showcasePriority) || request.body.showcasePriority < 0 || request.body.showcasePriority > 100) throw bad('Vitrin görünürlüğü ve öncelik (0–100) geçersiz.');
  const hotel = await HotelVideoIndex.findOneAndUpdate({ hotelId: text(request.params.hotelId, 120) }, { showcaseVisible: request.body.showcaseVisible, showcasePriority: request.body.showcasePriority }, { new: true, runValidators: true }).lean();
  if (!hotel) return response.status(404).json({ message: 'Otel indeksinde bulunamadı.' });
  await audit(request, 'hotel.showcase', hotel.hotelId); response.json({ hotel });
});
adminRouter.get('/providers', async (request, response) => response.json({
  nuitee: getNuiteeStatus(), database: mongoose.connection.readyState === 1,
  marginPercent: await readTravelMargin(),
  cardPublishableKeyConfigured: Boolean(process.env.NUITEE_STRIPE_PUBLISHABLE_KEY),
  cryptoWalletConfigured: Boolean(process.env.ROTAVOY_PAYMENT_WALLET),
  firebaseConfigured: Boolean(process.env.FIREBASE_PROJECT_ID),
  liveBookingEnabled: getNuiteeStatus().liveBookingEnabled,
  services: [{ key: 'hotels', search: true, booking: true }, { key: 'flights', search: true, booking: true }, { key: 'cars', search: false, booking: false }, { key: 'activities', search: false, booking: false }],
}));
adminRouter.get('/settings', async (request, response) => { const settings = await TravelAdminSettings.findOne({ key: 'travel' }).lean() || { supportEmail: '', supportPhone: '', announcement: '' }; response.json({ settings: { ...settings, marginPercent: resolveTravelMargin(settings) } }); });
adminRouter.put('/settings', async (request, response) => {
  const marginPercent = request.body.marginPercent;
  if (typeof marginPercent !== 'number' || !Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent > 100) throw bad('Komisyon oranı 0–100 arasında olmalı.');
  const supportEmail = text(request.body.supportEmail, 254);
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) throw bad('Geçerli bir destek e-postası gir.');
  const settings = await TravelAdminSettings.findOneAndUpdate({ key: 'travel' }, { marginPercent, supportEmail, supportPhone: text(request.body.supportPhone, 60), announcement: text(request.body.announcement, 500) }, { upsert: true, new: true, runValidators: true }).lean();
  await audit(request, 'settings.update', 'travel'); response.json({ settings });
});
for (const [path, Model, fields, enums] of [
  ['tickets', TravelSupportTicket, ['subject', 'email', 'clientReference', 'type', 'status', 'priority', 'note', 'reply'], { type: ['support', 'cancellation', 'refund', 'payment', 'provider'], status: ['open', 'in_progress', 'waiting_provider', 'resolved'], priority: ['normal', 'high', 'urgent'] }],
  ['content', TravelContent, ['title', 'type', 'destination', 'body', 'status'], { type: ['destination', 'campaign', 'guide'], status: ['draft', 'ready', 'archived'] }],
]) {
  adminRouter.get(`/${path}`, async (request, response) => {
    const { page, limit } = pagination(request.query); const filter = {};
    if (request.query.q) filter[path === 'tickets' ? 'subject' : 'title'] = new RegExp(literal(request.query.q), 'i');
    if (enums.status.includes(request.query.status)) filter.status = request.query.status;
    const [items, total] = await Promise.all([Model.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Model.countDocuments(filter)]);
    response.json({ items, total, page, limit });
  });
  async function save(request, response) {
    const body = {};
    for (const field of fields) if (request.body[field] !== undefined) {
      body[field] = text(request.body[field], ['note', 'body', 'reply'].includes(field) ? 5000 : 254);
      if (enums[field] && !enums[field].includes(body[field])) throw bad(`Geçersiz ${field}.`);
    }
    if (!body[path === 'tickets' ? 'subject' : 'title']) throw bad('Başlık zorunlu.');
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw bad('Geçersiz e-posta.');
    let item;
    if (request.params.id) {
      if (!mongoose.isValidObjectId(request.params.id)) throw bad('Geçersiz kayıt.');
      item = await Model.findByIdAndUpdate(request.params.id, body, { new: true, runValidators: true });
      if (!item) return response.status(404).json({ message: 'Kayıt bulunamadı.' });
    } else item = await Model.create({ ...body, ...(path === 'tickets' ? { createdBy: actor(request) } : {}) });
    await audit(request, `${path}.save`, String(item._id)); response.json({ item });
  }
  adminRouter.post(`/${path}`, save); adminRouter.put(`/${path}/:id`, save);
}
adminRouter.get('/audit', async (request, response) => {
  const { page, limit } = pagination(request.query);
  const [items, total] = await Promise.all([TravelAdminAudit.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), TravelAdminAudit.countDocuments()]);
  response.json({ items, total, page, limit });
});

adminRouter.get('/analytics', async (request, response) => {
  const { page, limit } = pagination(request.query);
  const days = Math.max(1, Math.min(365, Number(request.query.days) || 7));
  const filter = { createdAt: { $gte: new Date(Date.now() - days * 86400000) } };
  if (analyticsTypes.includes(request.query.type)) filter.type = request.query.type;
  if (request.query.visitorId) filter.visitorId = text(request.query.visitorId, 100);
  if (request.query.q) { const regex = new RegExp(literal(request.query.q), 'i'); filter.$or = ['visitorId', 'identity', 'ip', 'city', 'country', 'source', 'path', 'details.hotelName', 'details.origin', 'details.destination', 'details.originName', 'details.destinationName'].map(key => ({ [key]: regex })); }
  if (request.query.bots === 'exclude') filter.bot = { $ne: true };
  const [items, total, summary] = await Promise.all([
    TravelAnalytics.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    TravelAnalytics.countDocuments(filter),
    TravelAnalytics.aggregate([{ $match: filter }, { $facet: {
      visitorCards: [
        { $sort: { createdAt: -1, _id: -1 } },
        { $group: { _id: '$visitorId', identity: { $max: '$identity' }, ip: { $first: '$ip' }, city: { $first: '$city' }, country: { $first: '$country' }, device: { $first: '$device' }, browser: { $first: '$browser' }, source: { $first: '$source' }, lastSeen: { $first: '$createdAt' }, firstSeen: { $min: '$createdAt' }, events: { $sum: 1 }, sessionIds: { $addToSet: '$sessionId' }, hotelViews: { $sum: { $cond: [{ $eq: ['$type', 'hotel_view'] }, 1, 0] } }, flightSearches: { $sum: { $cond: [{ $eq: ['$type', 'flight_search'] }, 1, 0] } }, selections: { $sum: { $cond: [{ $in: ['$type', ['hotel_select', 'room_select', 'flight_select']] }, 1, 0] } } } },
        { $sort: { lastSeen: -1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
        { $project: { identity: 1, ip: 1, city: 1, country: 1, device: 1, browser: 1, source: 1, lastSeen: 1, firstSeen: 1, events: 1, hotelViews: 1, flightSearches: 1, selections: 1, sessions: { $size: '$sessionIds' } } },
      ],
      visitors: [{ $group: { _id: '$visitorId' } }, { $count: 'count' }],
      sessions: [{ $group: { _id: '$sessionId' } }, { $count: 'count' }],
      types: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
      locations: [{ $group: { _id: { country: '$country', city: '$city' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }],
      sources: [{ $group: { _id: '$source', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }],
      hotels: [{ $match: { type: 'hotel_view' } }, { $group: { _id: '$details.hotelId', name: { $first: '$details.hotelName' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }],
    } }]),
  ]);
  const grouped = request.query.view === 'visitors';
  response.json({ items: grouped ? summary[0]?.visitorCards || [] : items, total: grouped ? summary[0]?.visitors?.[0]?.count || 0 : total, eventTotal: total, page, limit, summary: summary[0] || {}, days, mode: grouped ? 'visitors' : 'events' });
});
