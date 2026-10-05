import 'dotenv/config';



const checks = [
  ['MongoDB bağlantı adresi', Boolean(process.env.MONGODB_URI) && !/USERNAME|PASSWORD|CLUSTER/.test(process.env.MONGODB_URI)],
  ['Nuitee katalog anahtarı', Boolean(process.env.NUITEE_API_KEY)],

  ['Canlı frontend origin', String(process.env.CLIENT_ORIGINS || '').split(',').some(o => /^https:\/\//.test(o.trim()) && !/localhost/.test(o))],
  ['Firebase proje kimliği', Boolean(process.env.FIREBASE_PROJECT_ID)],
  ['Admin izin listesi', Boolean(process.env.ROTAVOY_ADMIN_EMAILS || process.env.ADMIN_EMAIL || process.env.ROTAVOY_ADMIN_WALLETS)],


];
for (const [name, ok] of checks) console.log(`${ok ? 'OK' : 'EKSİK'}: ${name}`);
console.log('Yayın modu: rezervasyon talebi. Online ödeme ve rezervasyon oluşturma kapalıdır. Frontend VITE_API_BASE_URL canlı backend adresi olmalıdır. Bu kontrol ağ, veritabanı veya sağlayıcı erişimini doğrulamaz.');
process.exitCode = checks.every(([, ok]) => ok) ? 0 : 1;
