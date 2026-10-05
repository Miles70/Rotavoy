import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyFirebaseIdToken } from '../services/firebaseTokenVerification.js';
import { createFirebaseCustomerSession } from '../services/customerAuthService.js';
import { isTravelAdmin } from '../middleware/adminAuth.js';
export const adminAuthRouter = Router();
adminAuthRouter.use((request, response, next) => { response.set('Cache-Control', 'private, no-store'); next(); });
adminAuthRouter.post('/google', rateLimit({ windowMs: 600000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }), async (request, response) => {
  const identity = await verifyFirebaseIdToken(request.body?.idToken);
  if (identity.provider !== 'google.com' || !isTravelAdmin({ provider: 'firebase', email: identity.email, emailVerified: identity.emailVerified })) return response.status(403).json({ message: 'Bu Google hesabının yönetici yetkisi yok.' });
  const session = await createFirebaseCustomerSession(request.body.idToken);
  response.status(201).json({ session });
});
