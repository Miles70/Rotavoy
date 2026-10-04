export function assertConfirmedBooking(payload) {
  const data = payload?.data;
  if (payload?.error || !data?.bookingId || String(data.status).toUpperCase() !== "CONFIRMED") {
    const error = new Error("Reservation confirmation is pending. Please contact support with your booking reference before making another payment.");
    error.statusCode = 502;
    throw error;
  }
  return data;
}
