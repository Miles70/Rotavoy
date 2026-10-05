import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { TravelInquiry } from '../models/TravelInquiry.js';
export const inquiriesRouter = Router();
export function validateInquiry(body = {}) {
 const value = {};
 for (const [key, limit] of Object.entries({kind:20,name:120,email:254,phone:60,destination:200,hotelId:120,origin:200,startDate:10,endDate:10,notes:2000})) {
  if (body[key] != null && typeof body[key] !== 'string') throw new Error('Geçersiz talep bilgisi.');
  value[key] = (body[key] || '').trim();
  if (value[key].length > limit) throw new Error('Talep bilgisi çok uzun.');
 }
 value.email = value.email.toLowerCase();
 value.adults = Number(body.adults); value.children = Number(body.children || 0);
 const validDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
 if (!['hotel','flight','cars','activities'].includes(value.kind) || !value.name || !value.destination || (value.kind === 'flight' && !value.origin) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || !validDate(value.startDate) || value.startDate < new Date().toISOString().slice(0,10) || (value.endDate && (!validDate(value.endDate) || value.endDate < value.startDate)) || (value.kind === 'hotel' && (!value.endDate || value.endDate <= value.startDate)) || !Number.isInteger(value.adults) || value.adults < 1 || value.adults > 20 || !Number.isInteger(value.children) || value.children < 0 || value.children > 20) throw new Error('İletişim, tarih ve kişi bilgilerini kontrol et.');
 return value;
}
inquiriesRouter.post('/', rateLimit({windowMs:15*60*1000,limit:5,standardHeaders:'draft-8',legacyHeaders:false}), async (req,res,next) => {
 let value; try { value = validateInquiry(req.body); } catch(error) { return res.status(400).json({message:error.message}); }
 try { const inquiry = await TravelInquiry.create({...value, reference:`RV-${randomUUID()}`}); res.status(201).json({reference:inquiry.reference,status:inquiry.status}); } catch(error) { next(error); }
});
