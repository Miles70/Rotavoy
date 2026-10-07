import crypto from 'node:crypto';

// LiteAPI semantics: docs.liteapi.travel/reference/post_hotels-rates and
// /post_rates-prebook. Only verified fields are mapped here; never infer from names.
const mealPlans = { RO: 'roomOnly', BI: 'breakfast', HB: 'halfBoard', FB: 'fullBoard', AI: 'allInclusive', DI: 'dinner', LI: 'lunch', BDI: 'breakfastDinner', BLI: 'breakfastLunch', LDI: 'lunchDinner' };
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim().slice(0, 8000) : '';
const amount = value => ['number', 'string'].includes(typeof value) && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

function policyTime(value, timezone) {
  const time = text(value);
  // LiteAPI documents GMT even when timezone is omitted. Reject other zones
  // instead of allowing the server/browser's local timezone to shift a deadline.
  if (timezone && !['GMT', 'UTC'].includes(timezone)) return null;
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(time)) return null;
  const iso = `${time.replace(' ', 'T')}Z`;
  return Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0, 19) === iso.slice(0, 19) ? iso : null;
}

export function normalizeRateConditions(rate = {}) {
  const policy = rate.cancellationPolicies;
  const policies = list(policy?.cancelPolicyInfos).map(item => ({
    from: policyTime(item.cancelTime, item.timezone),
    amount: amount(item.amount), currency: text(item.currency),
    unit: item.type === 'amount' ? 'amount' : 'unknown',
  }));
  const taxes = Array.isArray(rate.retailRate?.taxesAndFees) ? rate.retailRate.taxesAndFees.map(item => ({
    included: typeof item.included === 'boolean' ? item.included : null,
    description: text(item.description), amount: amount(item.amount), currency: text(item.currency),
  })) : null;
  return {
    roomName: text(rate.name),
    adults: Number.isInteger(rate.adultCount) ? rate.adultCount : null,
    children: Number.isInteger(rate.childCount) ? rate.childCount : null,
    maxOccupancy: Number.isInteger(rate.maxOccupancy) ? rate.maxOccupancy : null,
    mealPlan: mealPlans[rate.boardType] || 'unknown',
    // The readable supplier name is safe only as a secondary fallback, never a raw code.
    mealPlanName: mealPlans[rate.boardType] || /^[A-Z0-9_]{1,6}$/.test(text(rate.boardName)) ? '' : text(rate.boardName),
    refundability: policy?.refundableTag === 'NRFN' ? 'nonRefundable' : policy?.refundableTag === 'RFN' ? 'refundable' : 'unknown',
    cancellationPolicies: policies,
    taxesAndFees: taxes,
    // null/empty tax lists do not prove that ALL taxes are included.
    taxesIncluded: taxes?.length > 0 && taxes.every(item => item.included === true) ? true : taxes?.some(item => item.included === false) ? false : null,
    remarks: [text(rate.remarks), ...list(policy?.hotelRemarks).map(text)].filter(Boolean),
  };
}

export function normalizeOfferConditions(offer = {}) {
  return { rooms: list(offer.rates).map(normalizeRateConditions), paymentTiming: offer.paymentSchedule === 'now' ? 'now' : null };
}

export function normalizePrebookTerms(data = {}) {
  const total = amount(data.price);
  return {
    total: total === null ? null : Math.round((total + Number.EPSILON) * 100) / 100,
    currency: text(data.currency),
    conditions: { rooms: list(data.roomTypes).flatMap(room => list(room.rates)).map(normalizeRateConditions), paymentTiming: null },
    bookingConditions: text(data.termsAndConditions),
  };
}

export function termsRevision(terms) {
  return crypto.createHash('sha256').update(JSON.stringify(terms)).digest('hex');
}

export function termChanges(previous, next, flags = {}) {
  const changes = [];
  if ((previous && (Number(previous.total) !== next.total || previous.currency !== next.currency)) || Number(flags.priceDifferencePercent)) changes.push('price');
  const before = previous?.conditions?.rooms || [], after = next.conditions.rooms;
  const different = pick => JSON.stringify(before.map(pick)) !== JSON.stringify(after.map(pick));
  if (flags.cancellationChanged === true || previous && different(r => [r.refundability, r.cancellationPolicies])) changes.push('cancellation');
  if (flags.boardChanged === true || previous && different(r => [r.mealPlan, r.mealPlanName])) changes.push('meal');
  if (previous && different(r => r.taxesAndFees)) changes.push('charges');
  if (previous && different(r => [r.roomName, r.adults, r.children])) changes.push('room');
  if (previous && previous.bookingConditions !== undefined && previous.bookingConditions !== next.bookingConditions) changes.push('conditions');
  return changes;
}

export function publicPrebook(data, previous) {
  const terms = normalizePrebookTerms(data);
  return {
    prebookId: text(data.prebookId || data.id), offerId: text(data.offerId), hotelId: text(data.hotelId),
    checkin: text(data.checkin), checkout: text(data.checkout), currency: terms.currency,
    sellingPriceToUser: terms.total, suggestedSellingPrice: terms.total,
    ...terms, revision: termsRevision(terms), changes: termChanges(previous, terms, data),
  };
}

export function requireAcceptedTerms(request, response, data) {
  const current = publicPrebook(data);
  if (request.body?.acceptedRevision === current.revision) return current;
  response.set('Cache-Control', 'no-store');
  response.status(409).json({ code: 'HOTEL_TERMS_CHANGED', message: 'Rezervasyon koşullarını kontrol edip yeniden onayla.', prebook: current });
  return null;
}
