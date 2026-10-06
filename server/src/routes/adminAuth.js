import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AdminSession } from '../models/AdminSession.js';
import { createPasswordAdminSession, authenticatePasswordAdmin } from '../services/adminPasswordAuth.js';

export const adminAuthRouter = Router();
adminAuthRouter.use((request, response, next) => { response.set('Cache-Control', 'private, no-store'); next(); });
adminAuthRouter.post('/password', rateLimit({
  windowMs: 600000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { message: 'Çok fazla giriş denemesi. Biraz sonra tekrar dene.' },
}), async (request, response, next) => {
  try { response.status(201).json({ session: await createPasswordAdminSession(request.body?.password) }); }
  catch (error) {
    if (error.statusCode === 503) return response.status(503).json({ message: error.message });
    next(error);
  }
});
adminAuthRouter.post('/logout', authenticatePasswordAdmin, async (request, response, next) => {
  try { await AdminSession.deleteOne({ _id: request.adminSession._id }); response.status(204).end(); }
  catch (error) { next(error); }
});
