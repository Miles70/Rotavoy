import { signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { adminFirebaseAuth, adminFirebaseReady } from '../config/firebase';
const base = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const key = 'rotavoy_admin_session_v1';
export function getAdminSession() {
  try { const data = JSON.parse(localStorage.getItem(key) || 'null'); return data?.token && Date.parse(data.expiresAt) > Date.now() ? data : null; } catch { return null; }
}
export async function loginAdmin() {
  await adminFirebaseReady;
  const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(adminFirebaseAuth, provider);
  const idToken = await result.user.getIdToken();
  const response = await fetch(`${base}/api/admin-auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Yönetici oturumu oluşturulamadı.');
  localStorage.setItem(key, JSON.stringify(data.session)); return data.session;
}
export async function logoutAdmin() {
  const session = getAdminSession(); localStorage.removeItem(key);
  await Promise.allSettled([signOut(adminFirebaseAuth), ...(session ? [fetch(`${base}/api/customer-auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } })] : [])]);
}
