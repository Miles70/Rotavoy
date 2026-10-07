export const extraFacilityKeys = {
  'fitness facilities': 'fitness', 'non-smoking rooms': 'nonSmokingRooms',
  'swimming pool': 'pool', laundry: 'laundry', cycling: 'cycling',
  'tour desk': 'tourDesk', terrace: 'terrace',
};
export function interpolate(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}
// Only explicit instants are converted. Ambiguous hotel-local timestamps remain untouched.
export function cancellationInstant(policy) {
  const text = String(policy?.cancelTime || '').trim();
  const naive = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/;
  let iso = text;
  if (naive.test(text)) {
    if (!['GMT', 'UTC'].includes(String(policy.timezone || '').toUpperCase())) return null;
    iso = text.replace(' ', 'T') + 'Z';
  } else if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return null;
  const clock = text.slice(11, 19).split(':').map(Number);
  if (clock[0] > 23 || clock[1] > 59 || clock[2] > 59) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  // Date silently normalizes invalid dates such as February 30: reject them.
  const day = text.slice(0, 10), dayDate = new Date(day + 'T00:00:00Z');
  if (!Number.isFinite(dayDate.getTime()) || dayDate.toISOString().slice(0, 10) !== day) return null;
  return date;
}
export function cancellationTimeLabel(policy, language, timeZone) {
  const date = cancellationInstant(policy);
  if (!date || !timeZone) return { date, local: false, label: [policy?.cancelTime, policy?.timezone].filter(Boolean).join(' ') };
  try {
    return { date, local: true, label: new Intl.DateTimeFormat(language === 'pt' ? 'pt-BR' : language, { dateStyle: 'long', timeStyle: 'short', timeZone }).format(date) };
  } catch {
    return { date, local: false, label: [policy?.cancelTime, policy?.timezone].filter(Boolean).join(' ') };
  }
}
