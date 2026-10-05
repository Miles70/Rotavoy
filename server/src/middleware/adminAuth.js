import { requireCustomer } from './customerAuth.js';
export function isTravelAdmin(customer) {
  const emails = String(process.env.ROTAVOY_ADMIN_EMAILS || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
  const wallets = String(process.env.ROTAVOY_ADMIN_WALLETS || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
  return Boolean(customer && ((customer.provider === 'firebase' && customer.emailVerified === true && emails.includes(String(customer.email || '').toLowerCase())) || (customer.provider === 'wallet' && wallets.includes(String(customer.providerId || '').toLowerCase()))));
}
export const requireAdmin = [requireCustomer, (request, response, next) => {
  if (!isTravelAdmin(request.customer)) return response.status(403).json({ message: 'Bu hesap Travel yönetim yetkisine sahip değil.' });
  next();
}];
