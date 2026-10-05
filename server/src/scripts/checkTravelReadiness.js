import 'dotenv/config';
import { getNuiteeStatus } from '../services/nuiteeApi.js';
import { getCryptoPaymentConfig } from '../config/cryptoPayment.js';
const status = getNuiteeStatus();
const checks = [
  ['MongoDB bağlantı adresi', Boolean(process.env.MONGODB_URI) && !/USERNAME|PASSWORD|CLUSTER/.test(process.env.MONGODB_URI)],
  ['Nuitee production anahtarı', status.environment === 'production'],
  ['Canlı rezervasyon etkin', status.liveBookingEnabled],
  ['Canlı frontend origin', String(process.env.CLIENT_ORIGINS || '').split(',').some(o => /^https:\/\//.test(o.trim()) && !/localhost/.test(o))],
  ['Firebase proje kimliği', Boolean(process.env.FIREBASE_PROJECT_ID)],
  ['Admin izin listesi', Boolean(process.env.ROTAVOY_ADMIN_EMAILS || process.env.ADMIN_EMAIL || process.env.ROTAVOY_ADMIN_WALLETS)],
  ['Kripto alıcı cüzdanı', getCryptoPaymentConfig('USDT', 'BSC').configured],
  ['Nuitee hesap ödeme yöntemi', ['ACC_CREDIT_CARD', 'WALLET', 'CREDIT'].includes(process.env.NUITEE_ACCOUNT_PAYMENT_METHOD || 'ACC_CREDIT_CARD')],
];
for (const [name, ok] of checks) console.log(`${ok ? 'OK' : 'EKSİK'}: ${name}`);
console.log('Bu kontrol gerçek ödeme yapmaz. Nuitee uçuş production yetkisi ve hesap kartı/bakiyesi sağlayıcı panelinde ayrıca doğrulanmalıdır. Frontend VITE_API_BASE_URL canlı backend adresi olmalıdır.');
process.exitCode = checks.every(([, ok]) => ok) ? 0 : 1;
