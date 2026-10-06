const base = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const key = 'rotavoy_admin_session_v2';
export function getAdminSession() {
  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    return data?.token && Date.parse(data.expiresAt) > Date.now() ? data : null;
  } catch { return null; }
}
export async function loginAdmin(password) {
  const response = await fetch(`${base}/api/admin-auth/password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Yönetici girişi tamamlanamadı.');
  if (!data.session?.token || !data.session?.expiresAt) throw new Error('Sunucudan geçerli bir yönetici oturumu alınamadı.');
  localStorage.setItem(key, JSON.stringify(data.session));
  return data.session;
}
export async function logoutAdmin() {
  const session = getAdminSession();
  if (session) {
    const response = await fetch(`${base}/api/admin-auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } });
    if (!response.ok && response.status !== 401) throw new Error('Çıkış tamamlanamadı. Tekrar dene.');
  }
  localStorage.removeItem(key);
}
