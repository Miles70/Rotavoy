import { getCustomerAccessToken } from './customerApi';
const base = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export async function adminRequest(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${base}/api/admin${path}`, { method, signal, headers: { Authorization: `Bearer ${getCustomerAccessToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || 'Yönetim verileri alınamadı.'); error.status = response.status; throw error; }
  return data;
}
export function downloadAdminCsv(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const cell = (value) => { const content = String(value ?? ''); return `"${(/^\s*[=+@-]/.test(content) ? "'" : '') + content.replaceAll('"', '""')}"`; };
  const csv = '\uFEFF' + [keys.map(cell).join(','), ...rows.map(row => keys.map(key => cell(row[key])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
