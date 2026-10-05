import { reservationSummary } from './bookingState.js';
import { TravelBooking } from '../models/TravelBooking.js';
import { bookNuiteeTransaction, bookNuiteeAccount, bookNuiteeFlight, findNuiteeBooking, getNuiteeFlightBooking } from './nuiteeApi.js';
import { providerBookingData, confirmedProviderBooking, publicReservation } from './bookingState.js';
export function bookingPayload(b) {
  return { id: b.clientReference, clientReference: b.clientReference, kind: b.kind || 'hotel', flight: b.flight || {}, stay: b.stay || {}, status: b.status, paymentStatus: b.paymentStatus, total: b.total, currency: b.currency,
    payment: b.payment?.method === 'card' ? { method: 'card', provider: 'nuitee' } : b.payment || {},
    customer: { fullName: `${b.holder?.firstName || ''} ${b.holder?.lastName || ''}`.trim(), email: b.holder?.email || '' }, reservation: reservationSummary(b.providerBooking, b.kind) };
}
async function applyResult(b, result) {
  const kind = b.kind || 'hotel'; const data = providerBookingData(result, kind);
  b.providerBooking = publicReservation(result, kind);
  b.status = confirmedProviderBooking(result, kind) ? 'confirmed' : 'processing';
  if (b.status === 'confirmed' || ['completed', 'succeeded'].includes(data.paymentStatus)) b.paymentStatus = 'paid';
  if (b.status === 'confirmed') { b.paymentExpiresAt = null; b.failureReason = ''; }
  await b.save(); return b;
}
export async function refreshBooking(b) {
  if (b.status !== 'processing') return b;
  const kind = b.kind || 'hotel';
  let result;
  if (kind === 'flight') {
    const id = b.providerBooking?.bookingId || b.flight?.providerBookingId;
    if (!id) return b;
    result = await getNuiteeFlightBooking(id);
  } else {
    const payload = await findNuiteeBooking(b.clientReference);
    const found = payload?.data?.find?.(item => item.clientReference === b.clientReference);
    if (!found) return b;
    result = { data: found };
  }
  return applyResult(b, result);
}
export async function finalizeBooking(b) {
  if (b.status === 'confirmed') return b;
  if (b.bookingAttemptAt) return refreshBooking(b);
  const claimed = await TravelBooking.findOneAndUpdate({ _id: b._id, bookingAttemptAt: null, status: { $in: ['awaiting_payment', 'processing'] } }, { $set: { bookingAttemptAt: new Date(), status: 'processing' } }, { new: true });
  if (!claimed) return TravelBooking.findById(b._id);
  try {
    const result = claimed.kind === 'flight' ? await bookNuiteeFlight(claimed.prebookId, claimed.payment.transactionId)
      : claimed.payment?.method === 'card' ? await bookNuiteeTransaction({ prebookId: claimed.prebookId, clientReference: claimed.clientReference, holder: claimed.holder, guests: claimed.guests, transactionId: claimed.payment.transactionId })
      : await bookNuiteeAccount({ prebookId: claimed.prebookId, clientReference: claimed.clientReference, holder: claimed.holder, guests: claimed.guests });
    return await applyResult(claimed, result);
  } catch (error) {
    claimed.failureReason = String(error.message).slice(0, 500);
    // An uncertain network response may have created a reservation upstream.
    // Keep the attempt marker and reconcile instead of submitting another booking.
    if (error.upstreamStatus === 400 && /payment.*not completed|payment.*not successful/i.test(error.message)) {
      claimed.status = 'awaiting_payment'; claimed.bookingAttemptAt = null;
    } else if (error.upstreamStatus === 410) { claimed.status = 'failed'; }
    await claimed.save();
    if (claimed.status === 'processing') return claimed;
    throw error;
  }
}
