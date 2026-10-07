export function cancellationStatus(condition, now = Date.now()) {
  if (condition?.refundability === 'nonRefundable') return { kind: 'nonRefundable', deadline: null };
  const policies = condition?.cancellationPolicies || [];
  if (condition?.refundability !== 'refundable' || !policies.length || policies.some(p => !p.from || p.amount === null || p.unit === 'unknown')) return { kind: condition?.refundability === 'refundable' ? 'refundable' : 'unknown', deadline: null };
  const sorted = [...policies].sort((a, b) => Date.parse(a.from) - Date.parse(b.from));
  const current = sorted.filter(p => Date.parse(p.from) <= now).at(-1);
  if (current?.amount > 0) return { kind: 'penalty', deadline: null };
  const nextPenalty = sorted.find(p => Date.parse(p.from) > now && p.amount > 0);
  return nextPenalty ? { kind: 'freeUntil', deadline: nextPenalty.from } : { kind: 'refundable', deadline: null };
}
