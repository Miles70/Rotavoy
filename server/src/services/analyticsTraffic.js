import crypto from 'node:crypto';
import { adminCredentials } from './adminPasswordAuth.js';
export const trafficTypes = ['visitor', 'admin', 'test', 'suspected_bot', 'unknown'];
export function createAnalyticsProof(kind, now = Date.now()) {
  if (!['admin', 'test'].includes(kind)) throw new Error('Invalid analytics context');
  const credentials = adminCredentials();
  if (!credentials) throw new Error('Admin configuration unavailable');
  const payload = Buffer.from(JSON.stringify({ kind, expires: now + 8 * 3600000, nonce: crypto.randomBytes(16).toString('hex') })).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', credentials.version).update(payload).digest('base64url')}`;
}
export function classifyTraffic(proof, ua, now = Date.now()) {
  const credentials = adminCredentials();
  if (typeof proof === 'string' && proof.length < 1000 && credentials) {
    try {
      const [payload, signature] = proof.split('.');
      const expected = crypto.createHmac('sha256', credentials.version).update(payload).digest();
      const actual = Buffer.from(signature, 'base64url');
      if (actual.length === expected.length && crypto.timingSafeEqual(actual, expected)) {
        const data = JSON.parse(Buffer.from(payload, 'base64url'));
        if (['admin', 'test'].includes(data.kind) && data.expires > now && data.expires <= now + 8 * 3600000) return { trafficType: data.kind, classificationReason: 'signed_context_v2' };
      }
    } catch { /* Untrusted context cannot establish admin/test identity. */ }
  }
  if (/bot|crawler|spider|headless|playwright|selenium/i.test(ua || '')) return { trafficType: 'suspected_bot', classificationReason: 'automation_user_agent' };
  if (proof) return { trafficType: 'unknown', classificationReason: 'invalid_or_expired_context' };
  return { trafficType: 'visitor', classificationReason: 'no_exclusion_signal' };
}
// Missing historical evidence stays unknown. A UA flag is suspicion, never proof.
export const effectiveTraffic = { $ifNull: ['$trafficType', { $cond: [{ $eq: ['$bot', true] }, 'suspected_bot', 'unknown'] }] };
