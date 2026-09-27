import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import CryptoPayment from "../components/CryptoPayment/CryptoPayment";
import TravelCardPayment from "../components/TravelCardPayment/TravelCardPayment";
import {
  createTravelCheckout,
  getTravelBooking,
  verifyTravelPayment,
} from "../services/hotelsApi";
import "./TravelCheckout.css";

const TRAVEL_CONTEXT_PREFIX = "rotavoy_travel_checkout_";

function readTravelContext(clientReference) {
  if (!clientReference || typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(
      `${TRAVEL_CONTEXT_PREFIX}${clientReference}`,
    );
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveTravelContext(clientReference, context) {
  if (!clientReference || typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      `${TRAVEL_CONTEXT_PREFIX}${clientReference}`,
      JSON.stringify(context),
    );
  } catch {
    // The payment flow remains functional when session storage is unavailable.
  }
}

function compactTravelContext({ hotel, offer, prebook, checkin, checkout, adults }) {
  return {
    hotel: {
      hotelId: hotel?.hotelId || "",
      name: hotel?.name || "",
      hotelName: hotel?.hotelName || "",
      address: hotel?.address || "",
      main_photo: hotel?.main_photo || "",
      stars: hotel?.stars || "",
    },
    offer: { offerId: offer?.offerId || "" },
    prebook: {
      currency: prebook?.currency || "USD",
      sellingPriceToUser: prebook?.sellingPriceToUser || 0,
      suggestedSellingPrice: prebook?.suggestedSellingPrice || null,
    },
    checkin,
    checkout,
    adults,
  };
}

function money(amount, currency = "EUR") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function TravelCheckout() {
  const { state } = useLocation();
  const [searchParams] = useSearchParams();
  const returnBookingReference = searchParams.get("booking") || "";
  const returnPaymentClientSecret =
    searchParams.get("payment_intent_client_secret") || "";
  const [returnContext] = useState(() =>
    readTravelContext(returnBookingReference),
  );
  const checkoutContext = state || returnContext || {};
  const hotel = checkoutContext.hotel;
  const prebook = checkoutContext.prebook;
  const offer = checkoutContext.offer || hotel?.offer;
  const adults = Math.max(Number(checkoutContext.adults) || 1, 1);
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
  const [paymentMethod, setPaymentMethod] = useState("crypto");
  const [restoreState, setRestoreState] = useState(
    returnBookingReference ? "loading" : "idle",
  );
  const [restoreError, setRestoreError] = useState("");

  useEffect(() => {
    if (!returnBookingReference) return undefined;

    let cancelled = false;
    getTravelBooking(returnBookingReference)
      .then((returnedBooking) => {
        if (cancelled) return;
        setBooking(returnedBooking);
        setPaymentMethod(returnedBooking.paymentMethod || "card");
        setRestoreState("success");
      })
      .catch((bookingError) => {
        if (cancelled) return;
        setRestoreState("error");
        setRestoreError(
          bookingError.message || "Rezervasyon ödeme oturumu bulunamadı.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [returnBookingReference]);

  const hotelName = hotel?.name || hotel?.hotelName || "Seçilen otel";
  const price = Number(
    booking?.total ??
      prebook?.sellingPriceToUser ??
      prebook?.suggestedSellingPrice?.amount ??
      hotel?.offer?.suggestedSellingPrice?.amount ??
      0,
  );
  const currency =
    booking?.currency ||
    prebook?.currency ||
    hotel?.offer?.suggestedSellingPrice?.currency ||
    "USD";

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
      const result = await createTravelCheckout({
        offerId: offer.offerId,
        holder,
        guests,
        paymentMethod,
      });
      saveTravelContext(
        result.clientReference,
        compactTravelContext({
          hotel,
          offer,
          prebook,
          checkin: checkoutContext.checkin,
          checkout: checkoutContext.checkout,
          adults,
        }),
      );
      setBooking(result);
      setSubmitState("success");
    } catch (bookingError) {
      setSubmitState("error");
      setError(bookingError.message || "Rezervasyon şu anda tamamlanamadı.");
    }
  }

  if (returnBookingReference && restoreState === "loading") {
    return (
      <main className="travelCheckoutState">
        <LoaderCircle className="travelSpin" size={30} />
        <h1>Ödeme doğrulanıyor</h1>
        <p>Rezervasyon ve 3D Secure sonucu kontrol ediliyor.</p>
      </main>
    );
  }

  if (restoreState === "error") {
    return (
      <main className="travelCheckoutState">
        <AlertCircle size={30} />
        <h1>Ödeme oturumu bulunamadı</h1>
        <p>{restoreError}</p>
        <Link to="/travel">Otel aramasına dön</Link>
      </main>
    );
  }

  if ((!hotel || !prebook || !offer?.offerId) && !returnBookingReference) {
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
        <p>
          {hotelName} için {booking.paymentMethod === "card" ? "kart ödemen ve" : "USDT ödemen ve"} rezervasyonun başarıyla onaylandı.
        </p>
        <strong>Referans: {booking.clientReference}</strong>
        <Link to="/travel">Yeni otel ara</Link>
      </main>
    );
  }

  return (
    <main className="travelCheckoutPage">
      <div className="travelCheckoutContainer">
        <Link
          className="travelCheckoutBack"
          to={hotel?.hotelId ? `/travel/hotels/${encodeURIComponent(hotel.hotelId)}` : "/travel"}
        >
          <ArrowLeft size={18} /> Otele dön
        </Link>
        <div className="travelCheckoutGrid">
          <section>
            <span className="travelCheckoutEyebrow">GÜVENLİ REZERVASYON</span>
            <h1>Misafir bilgileri</h1>
            <p className="travelCheckoutLead">
              Bilgileri kontrol et. Oda ve toplam fiyat tekrar doğrulanır; ardından seçtiğin güvenli ödeme adımına geçersin.
            </p>
            {booking ? (
              booking.paymentMethod === "card" ? (
                <TravelCardPayment
                  booking={booking}
                  onOrderUpdated={setBooking}
                  returnPaymentClientSecret={returnPaymentClientSecret}
                />
              ) : (
                <CryptoPayment
                  order={booking}
                  onOrderUpdated={setBooking}
                  verifyPaymentRequest={verifyTravelPayment}
                  forceDisplay
                />
              )
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
              <div className="travelPaymentChoices" role="group" aria-label="Ödeme yöntemi">
                <button
                  type="button"
                  className={`travelPaymentChoice ${paymentMethod === "card" ? "active" : ""}`}
                  aria-pressed={paymentMethod === "card"}
                  onClick={() => setPaymentMethod("card")}
                >
                  <strong>Kartla ödeme</strong>
                  <span>3D Secure ile güvenli ödeme</span>
                </button>
                <button
                  type="button"
                  className={`travelPaymentChoice ${paymentMethod === "crypto" ? "active" : ""}`}
                  aria-pressed={paymentMethod === "crypto"}
                  onClick={() => setPaymentMethod("crypto")}
                >
                  <strong>USDT</strong>
                  <span>BNB Chain üzerinden kripto ödeme</span>
                </button>
              </div>
              {error && <p className="travelCheckoutError"><AlertCircle size={17} /> {error}</p>}
              <button className="travelCheckoutSubmit" disabled={submitState === "loading"} type="submit">
                {submitState === "loading" ? <LoaderCircle className="travelSpin" size={19} /> : <LockKeyhole size={18} />}
                {submitState === "loading"
                  ? "Fiyat ve oda doğrulanıyor"
                  : paymentMethod === "card"
                    ? "Kart ödeme adımına geç"
                    : "USDT ödeme adımına geç"}
              </button>
              <p className="travelCheckoutSecurity">
                <ShieldCheck size={16} />
                {paymentMethod === "card"
                  ? "Kart bilgilerin Rotavoy sunucusuna ulaşmaz; bankan gerek görürse 3D Secure doğrulaması açılır."
                  : "Kart bilgisi alınmaz. Rezervasyon yalnızca USDT transferi zincirde doğrulandıktan sonra oluşturulur."}
              </p>
            </form>
            )}
          </section>
          <aside className="travelCheckoutSummary">
            <span>REZERVASYON ÖZETİ</span>
            <h2>{hotelName}</h2>
            <dl>
              <div><dt>Giriş</dt><dd>{checkoutContext.checkin || "—"}</dd></div>
              <div><dt>Çıkış</dt><dd>{checkoutContext.checkout || "—"}</dd></div>
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
