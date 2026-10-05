import { getCustomerAccessToken } from './customerApi';
const base = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
let memoryVisitor, memorySession, memorySource = '';
const id = () => globalThis.crypto?.randomUUID?.() || `rv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
function identifiers() {
  memoryVisitor ||= id(); memorySession ||= id();
  try {
    memoryVisitor = localStorage.getItem('rotavoy_visitor_v1') || memoryVisitor;
    localStorage.setItem('rotavoy_visitor_v1', memoryVisitor);
    const saved = JSON.parse(sessionStorage.getItem('rotavoy_visit_v1') || 'null');
    if (saved && Date.now() - saved.last < 1800000) memorySession = saved.id;
    else if (saved) memorySession = id();
    const source = new URLSearchParams(window.location.search).get('utm_source');
    if (source) memorySource = source.slice(0, 100);
    else if (saved?.id === memorySession) memorySource = saved.source || '';
    else { try { const ref = new URL(document.referrer); memorySource = ref.origin !== window.location.origin ? ref.origin : 'direct'; } catch { memorySource = 'direct'; } }
    sessionStorage.setItem('rotavoy_visit_v1', JSON.stringify({ id: memorySession, last: Date.now(), source: memorySource }));
  } catch { /* In-memory IDs work with blocked browser storage. */ }
  return { visitorId: memoryVisitor, sessionId: memorySession };
}
const queueKey = 'rotavoy_analytics_queue_v1';
const statusKey = 'rotavoy_analytics_status_v1';
let pending = [];
try { pending = JSON.parse(sessionStorage.getItem(queueKey) || '[]'); if (!Array.isArray(pending)) pending = []; pending = pending.slice(-100); } catch { /* Storage unavailable. */ }
let running = false, timer;
function persist() { try { sessionStorage.setItem(queueKey, JSON.stringify(pending)); } catch { /* Keep in memory. */ } }
function status(values) { try { const previous = JSON.parse(localStorage.getItem(statusKey) || '{}'); localStorage.setItem(statusKey, JSON.stringify({ ...previous, ...values, pending: pending.length })); } catch { /* Optional diagnostic. */ } }
function schedule(delay = 100) { if (!timer) timer = setTimeout(() => { timer = undefined; void flushTravelAnalytics(); }, delay); }
export async function flushTravelAnalytics() {
  if (running || !pending.length) return;
  running = true;
  let sent = 0;
  try {
    while (pending.length && sent < 10) {
      const body = pending[0];
      let token = ''; try { token = getCustomerAccessToken(); } catch { /* Track anonymously. */ }
      const send = auth => fetch(`${base}/api/visits/events`, { method: 'POST', keepalive: true, signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body) });
      status({ lastAttempt: new Date().toISOString() });
      let response = await send(token);
      if (response.status === 401 && token) response = await send('');
      if (!response.ok) {
        const error = new Error(`Analitik HTTP ${response.status}`);
        if (response.status === 400) { pending.shift(); persist(); }
        throw error;
      }
      pending.shift(); persist(); sent++;
      status({ lastSuccess: new Date().toISOString(), lastError: '' });
    }
  } catch (error) { status({ lastError: error.message || 'Analitik bağlantısı kurulamadı.' }); }
  finally { running = false; if (pending.length) schedule(10000); }
}
export function trackTravel(type, details = {}) {
  if (window.location.pathname.startsWith('/admin')) return;
  try {
    const params = new URLSearchParams(window.location.search);
    const body = { ...identifiers(), eventId: id(), type, path: window.location.pathname, referrer: document.referrer, source: params.get('utm_source') || memorySource, details };
    pending.push(body); pending = pending.slice(-100); persist(); status({}); schedule();
  } catch { /* Analytics never interrupts travel actions. */ }
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushTravelAnalytics());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flushTravelAnalytics(); });
  if (pending.length) schedule();
}
