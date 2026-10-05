import crypto from 'node:crypto';
export const hashBookingAccess = value => crypto.createHash('sha256').update(String(value)).digest('hex');
export function createBookingAccess() { const token = crypto.randomBytes(32).toString('hex'); return { token, hash: hashBookingAccess(token) }; }
export function requireBookingAccess(request, booking) {
  if (request.customer && booking.customerId && String(request.customer._id) === String(booking.customerId)) return;
  const token = request.headers['x-booking-token'];
  const hash = typeof token === 'string' ? hashBookingAccess(token) : '';
  if (hash && booking.accessTokenHash?.length === hash.length && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(booking.accessTokenHash))) return;
  throw Object.assign(new Error('Bu rezervasyona erişmek için hesabına giriş yap veya ödeme oturumunu aç.'), { statusCode: 403 });
}
