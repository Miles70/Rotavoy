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
export function trackTravel(type, details = {}) {
  if (window.location.pathname.startsWith('/admin')) return;
  try {
    const token = getCustomerAccessToken();
    const params = new URLSearchParams(window.location.search);
    const body = { ...identifiers(), eventId: id(), type, path: window.location.pathname, referrer: document.referrer, source: params.get('utm_source') || memorySource, details };
    void fetch(`${base}/api/analytics/events`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }).catch(() => {});
  } catch { /* Analytics must never interrupt booking or navigation. */ }
}
