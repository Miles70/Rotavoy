export function providerBookingData(payload, kind = 'hotel') {
  const data = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  const booking = kind === 'flight' ? data?.booking || data : data;
  if (payload?.error || !booking?.bookingId) throw Object.assign(new Error('Sağlayıcı rezervasyon sonucunu doğrulayamadı. Durum kontrolü gerekiyor.'), { statusCode: 502, bookingUnknown: true });
  return booking;
}
export function confirmedProviderBooking(payload, kind = 'hotel') {
  const data = providerBookingData(payload, kind);
  return String(data.status).toUpperCase() === 'CONFIRMED';
}
export function publicReservation(payload, kind = 'hotel') {
  const data = providerBookingData(payload, kind);
  return { bookingId: data.bookingId, status: data.status, hotelConfirmationCode: data.hotelConfirmationCode || '', bookingRef: data.bookingRef || '', airlineLocators: (data.airlineLocators || data.order?.reference?.airlineBookings || []).map(a => ({ airlineCode: a.airlineCode, airlineName: a.airlineName, airlinePnr: a.airlinePnr || a.pnr })), ticketData: data.ticketData ? { confirmationId: data.ticketData.confirmationId, ticketedAt: data.ticketData.ticketedAt } : null };
}

export function reservationSummary(value, kind = 'hotel') {
  if (!value) return {};
  try { return publicReservation(value.data ? value : { data: value }, kind); } catch { return {}; }
}
