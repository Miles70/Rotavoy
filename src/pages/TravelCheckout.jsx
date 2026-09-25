import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import CryptoPayment from "../components/CryptoPayment/CryptoPayment";
import { createTravelCheckout, verifyTravelPayment } from "../services/hotelsApi";
import "./TravelCheckout.css";

function money(amount, currency = "EUR") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function TravelCheckout() {
  const { state } = useLocation();
  const hotel = state?.hotel;
  const prebook = state?.prebook;
  const offer = state?.offer || hotel?.offer;
  const adults = Math.max(Number(state?.adults) || 1, 1);
  const [form, setForm] = useState(() => ({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    guests: Array.from({ length: adults }, () => ({ firstName: "", lastName: "" })),
  }));
  const [submitState, setSubmitState] = useState("idle");
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(null);

  const hotelName = hotel?.name || hotel?.hotelName || "Seçilen otel";
  const price = Number(
    prebook?.sellingPriceToUser ??
      prebook?.suggestedSellingPrice?.amount ??
      hotel?.offer?.suggestedSellingPrice?.amount ??
      0,
  );
  const currency = prebook?.currency || hotel?.offer?.suggestedSellingPrice?.currency || "EUR";

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateGuest(index, field, value) {
    setForm((current) => ({
      ...current,
      guests: current.guests.map((guest, guestIndex) =>
        guestIndex === index ? { ...guest, [field]: value } : guest,
      ),
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!offer?.offerId || submitState === "loading") return;

    setSubmitState("loading");
    setError("");

    try {
      const holder = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
      };
      const guests = form.guests.map((guest, index) => ({
        ...guest,
        email: form.email,
        occupancyNumber: index + 1,
      }));
      const result = await createTravelCheckout({ offerId: offer.offerId, holder, guests });
      setBooking(result);
      setSubmitState("success");
    } catch (bookingError) {
      setSubmitState("error");
      setError(bookingError.message || "Rezervasyon şu anda tamamlanamadı.");
    }
  }

  if (!hotel || !prebook || !offer?.offerId) {
    return (
      <main className="travelCheckoutState">
        <AlertCircle size={30} />
        <h1>Rezervasyon oturumu bulunamadı</h1>
        <p>Oda ve güncel fiyat yeniden kontrol edilmelidir.</p>
        <Link to="/travel">Otel aramasına dön</Link>
      </main>
    );
  }

  if (booking?.status === "confirmed") {
    return (
      <main className="travelCheckoutState travelCheckoutState--success">
        <CheckCircle2 size={42} />
        <h1>Rezervasyon onaylandı</h1>
        <p>{hotelName} için USDT ödemesi ve Nuitee rezervasyonu başarıyla onaylandı.</p>
        <strong>Referans: {booking.clientReference}</strong>
        <Link to="/travel">Yeni otel ara</Link>
      </main>
    );
  }

  return (
    <main className="travelCheckoutPage">
      <div className="travelCheckoutContainer">
        <Link className="travelCheckoutBack" to={`/travel/hotels/${encodeURIComponent(hotel.hotelId)}`}>
          <ArrowLeft size={18} /> Otele dön
        </Link>
        <div className="travelCheckoutGrid">
          <section>
            <span className="travelCheckoutEyebrow">GÜVENLİ REZERVASYON</span>
            <h1>Misafir bilgileri</h1>
            <p className="travelCheckoutLead">Bilgileri kontrol et. Oda ve toplam fiyat tekrar doğrulanır; ardından USDT ödeme adımına geçersin.</p>
            {booking ? (
              <CryptoPayment
                order={booking}
                onOrderUpdated={setBooking}
                verifyPaymentRequest={verifyTravelPayment}
                forceDisplay
              />
            ) : (
            <form onSubmit={submit} className="travelCheckoutForm">
              <div className="travelCheckoutFormGrid">
                <label>Ad<input required value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} autoComplete="given-name" /></label>
                <label>Soyad<input required value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} autoComplete="family-name" /></label>
                <label className="travelCheckoutWide">E-posta<input required type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} autoComplete="email" /></label>
                <label className="travelCheckoutWide">Telefon<input required type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} autoComplete="tel" /></label>
              </div>
              <div className="travelGuestFields">
                <h2>Konaklayacak misafirler</h2>
                {form.guests.map((guest, index) => (
                  <div className="travelCheckoutFormGrid" key={index}>
                    <strong className="travelCheckoutWide">Misafir {index + 1}</strong>
                    <label>Ad<input required value={guest.firstName} onChange={(event) => updateGuest(index, "firstName", event.target.value)} /></label>
                    <label>Soyad<input required value={guest.lastName} onChange={(event) => updateGuest(index, "lastName", event.target.value)} /></label>
                  </div>
                ))}
              </div>
              {error && <p className="travelCheckoutError"><AlertCircle size={17} /> {error}</p>}
              <button className="travelCheckoutSubmit" disabled={submitState === "loading"} type="submit">
                {submitState === "loading" ? <LoaderCircle className="travelSpin" size={19} /> : <LockKeyhole size={18} />}
                {submitState === "loading" ? "Fiyat ve oda doğrulanıyor" : "USDT ödeme adımına geç"}
              </button>
              <p className="travelCheckoutSecurity"><ShieldCheck size={16} /> Kart bilgisi alınmaz. Rezervasyon yalnızca USDT transferi zincirde doğrulandıktan sonra oluşturulur.</p>
            </form>
            )}
          </section>
          <aside className="travelCheckoutSummary">
            <span>REZERVASYON ÖZETİ</span>
            <h2>{hotelName}</h2>
            <dl>
              <div><dt>Giriş</dt><dd>{state.checkin}</dd></div>
              <div><dt>Çıkış</dt><dd>{state.checkout}</dd></div>
              <div><dt>Misafir</dt><dd>{adults} yetişkin</dd></div>
            </dl>
            <div className="travelCheckoutTotal"><span>Toplam konaklama</span><strong>{money(price, currency)}</strong></div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default TravelCheckout;
