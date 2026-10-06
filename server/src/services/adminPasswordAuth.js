import crypto from 'node:crypto';
import { AdminSession } from '../models/AdminSession.js';

export function hashAdminToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function adminCredentials() {
  const password = process.env.ROTAVOY_ADMIN_PASSWORD || '';
  if (password.length < 12 || password.length > 1024) return null;
  return { password, version: crypto.createHmac('sha256', password).update('rotavoy-admin-password-v1').digest('hex') };
}

export async function createPasswordAdminSession(password) {
  const credentials = adminCredentials();
  if (!credentials) {
    const error = new Error('Yönetici şifresi sunucuda henüz tanımlanmamış.');
    error.statusCode = 503;
    throw error;
  }
  if (typeof password !== 'string' || password.length > 1024 || !crypto.timingSafeEqual(
    Buffer.from(hashAdminToken(password)), Buffer.from(hashAdminToken(credentials.password)),
  )) {
    const error = new Error('Şifre yanlış.');
    error.statusCode = 401;
    throw error;
  }
  const token = `admin_${crypto.randomBytes(32).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await AdminSession.create({ tokenHash: hashAdminToken(token), credentialVersion: credentials.version, expiresAt });
  return { token, expiresAt, provider: 'password' };
}

export async function authenticatePasswordAdmin(request, response, next) {
  try {
    const token = String(request.headers.authorization || '').match(/^Bearer\s+(admin_[A-Za-z0-9_-]{43})$/i)?.[1];
    const credentials = adminCredentials();
    const session = token && credentials ? await AdminSession.findOne({
      tokenHash: hashAdminToken(token), credentialVersion: credentials.version, expiresAt: { $gt: new Date() },
    }) : null;
    if (!session) return response.status(401).json({ message: 'Yönetici oturumu geçersiz veya süresi dolmuş. Tekrar giriş yap.' });
    request.adminSession = session;
    // Existing operation and audit routes use this actor shape.
    request.customer = { provider: 'password', providerId: 'admin', displayName: 'Yönetici' };
    next();
  } catch (error) { next(error); }
}
