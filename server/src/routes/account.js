import { Router } from 'express';
import mongoose from 'mongoose';
import { requireCustomer } from '../middleware/customerAuth.js';
import { TravelAccount } from '../models/TravelAccount.js';
import { TravelBooking } from '../models/TravelBooking.js';
import { TravelSupportTicket } from '../models/TravelAdmin.js';
export const accountRouter = Router();
accountRouter.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
accountRouter.use(requireCustomer);
const clean = (v, n = 120) => String(v || '').trim().slice(0, n);
const bad = message => Object.assign(new Error(message), { statusCode: 400 });
const owner = req => ({ customerId: req.customer._id });
export function publicBooking(b) {
  return { clientReference: b.clientReference, status: b.status, paymentStatus: b.paymentStatus, total: b.total, currency: b.currency, stay: b.stay, createdAt: b.createdAt, holder: b.holder, guests: b.guests };
}
accountRouter.get('/', async (req, res) => {
  const [account, bookings, tickets] = await Promise.all([
    TravelAccount.findOne(owner(req)).lean(),
    TravelBooking.find(owner(req)).sort({ createdAt: -1 }).limit(100).lean(),
    TravelSupportTicket.find(owner(req)).select('subject message reply type status clientReference createdAt updatedAt').sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  res.json({ favorites: account?.favorites || [], travelers: account?.travelers || [], bookings: bookings.map(publicBooking), tickets });
});
accountRouter.get('/preferences', async (req, res) => {
  const account = await TravelAccount.findOne(owner(req)).lean();
  res.json({ favorites: account?.favorites || [], travelers: account?.travelers || [] });
});
accountRouter.put('/favorites/:hotelId', async (req, res) => {
  const hotelId = clean(req.params.hotelId, 100);
  if (!/^[\w-]+$/.test(hotelId)) throw bad('Geçerli bir otel seç.');
  const image = clean(req.body.image, 1500);
  const favorite = { hotelId, name: clean(req.body.name, 200) || hotelId, image: /^https:\/\//i.test(image) ? image : '' };
  await TravelAccount.updateOne(owner(req), { $setOnInsert: { ...owner(req) } }, { upsert: true });
  const account = await TravelAccount.findOneAndUpdate({ ...owner(req), 'favorites.hotelId': { $ne: hotelId }, 'favorites.99': { $exists: false } }, { $push: { favorites: favorite } }, { new: true });
  if (!account) {
    const existing = await TravelAccount.findOne(owner(req)).lean();
    if (!existing.favorites.some(f => f.hotelId === hotelId)) throw bad('En fazla 100 otel kaydedebilirsin.');
  }
  res.status(204).end();
});
accountRouter.delete('/favorites/:hotelId', async (req, res) => {
  await TravelAccount.updateOne(owner(req), { $pull: { favorites: { hotelId: req.params.hotelId } } }); res.status(204).end();
});
accountRouter.post('/travelers', async (req, res) => {
  const traveler = Object.fromEntries(['firstName', 'lastName', 'email', 'phone'].map(k => [k, clean(req.body[k], k === 'email' ? 254 : 100)]));
  if (!traveler.firstName || !traveler.lastName) throw bad('Ad ve soyad zorunlu.');
  if (traveler.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(traveler.email)) throw bad('Geçerli e-posta gir.');
  await TravelAccount.updateOne(owner(req), { $setOnInsert: owner(req) }, { upsert: true });
  const account = await TravelAccount.findOneAndUpdate({ ...owner(req), 'travelers.19': { $exists: false } }, { $push: { travelers: traveler } }, { new: true, runValidators: true });
  if (!account) throw bad('En fazla 20 yolcu kaydedebilirsin.');
  res.status(201).json({ travelers: account.travelers });
});
accountRouter.delete('/travelers/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw bad('Geçerli yolcu seç.');
  await TravelAccount.updateOne(owner(req), { $pull: { travelers: { _id: req.params.id } } }); res.status(204).end();
});
accountRouter.post('/tickets', async (req, res) => {
  const subject = clean(req.body.subject, 200), message = clean(req.body.message, 3000), clientReference = clean(req.body.clientReference, 120);
  if (!subject || !message) throw bad('Başlık ve mesaj zorunlu.');
  if (clientReference && !await TravelBooking.exists({ ...owner(req), clientReference })) throw bad('Bu rezervasyon hesabına bağlı değil.');
  if (await TravelSupportTicket.countDocuments({ ...owner(req), status: { $ne: 'resolved' } }) >= 20) throw bad('20 açık talebin var. Önce mevcut taleplerden devam edelim.');
  const ticket = await TravelSupportTicket.create({ ...owner(req), subject, message, clientReference, email: req.customer.email || '', createdBy: `customer:${req.customer._id}` });
  res.status(201).json({ ticket: { _id: ticket._id, subject, message, status: ticket.status } });
});
