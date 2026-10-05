import { Link } from 'react-router-dom';
export default function ReservationResult({ booking, onRefresh }) {
  const confirmed = booking?.status === 'confirmed';
  const terminal = ['failed', 'expired'].includes(booking?.status);
  const reservation = booking?.reservation || {};
  return <section className="accountCard"><h1>{confirmed ? (booking.kind === 'flight' ? 'Uçuş rezervasyonun onaylandı' : 'Otel rezervasyonun onaylandı') : terminal ? 'Rezervasyon tamamlanamadı' : 'Rezervasyonun kontrol ediliyor'}</h1><p>Rotavoy referansı: <strong>{booking.clientReference}</strong></p>{reservation.bookingId && <p>Rezervasyon numarası: <strong>{reservation.bookingId}</strong></p>}{reservation.hotelConfirmationCode && <p>Otel onay kodu: <strong>{reservation.hotelConfirmationCode}</strong></p>}{reservation.bookingRef && <p>Uçuş referansı: <strong>{reservation.bookingRef}</strong></p>}{reservation.airlineLocators?.map((a, i) => <p key={i}>{a.airlineName || a.airlineCode}: <strong>{a.airlinePnr || a.pnr}</strong></p>)}{!confirmed && !terminal && <p>Sağlayıcıdan kesin sonuç bekleniyor. Yeni ödeme yapmadan mevcut rezervasyonun durumunu kontrol edebilirsin.</p>}<div className="accountCardBottom">{!confirmed && onRefresh && <button onClick={onRefresh}>Durumu kontrol et</button>}<Link to="/account">Rezervasyonlarım</Link><Link to="/support">Destek</Link></div></section>;
}
