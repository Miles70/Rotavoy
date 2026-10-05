import { TravelBooking } from '../models/TravelBooking.js';
import { refreshBooking } from './finalizeBooking.js';
// Reconcile known attempts after browser closure or interrupted provider responses.
// This worker never creates a new hotel booking or initiates a charge.
export function startBookingReconciliation() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const bookings = await TravelBooking.find({ status: 'processing', bookingAttemptAt: { $lt: new Date(Date.now() - 130000) } }).sort({ updatedAt: 1 }).limit(20);
      for (const booking of bookings) {
        try { await refreshBooking(booking); }
        catch (error) { console.warn(`Reservation reconciliation pending: ${booking.clientReference}: ${String(error.message).slice(0, 200)}`); }
      }
    } catch (error) { console.warn(`Reservation reconciliation unavailable: ${String(error.message).slice(0, 200)}`); }
    finally { running = false; }
  }, 30000);
  timer.unref();
  return () => clearInterval(timer);
}
