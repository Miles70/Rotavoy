import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import CryptoPayment from "../components/CryptoPayment/CryptoPayment";
import NuiteeCardPayment from "../components/NuiteeCardPayment/NuiteeCardPayment";
import {
  createCardPaymentSession,
  createTravelCheckout,
  finalizeCardPayment,
  verifyTravelPayment,
} from "../services/hotelsApi";
import "./TravelCheckout.css";

function money(amount, currency = "EUR") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function TravelCheckout() {
  const location = useLocation();
  const { state } = location;
  const returnParams = new URLSearchParams(location.search);
  const cardReturnReference = returnParams.get("cardRef") || "";
  const redirectStatus = returnParams.get("redirect_status") || "";
  const isCardReturn = Boolean(cardReturnReference);

  const [returnState, setReturnState] = useState("idle");
  const [returnError, setReturnError] = useState("");
  const [returnBooking, setReturnBooking] = useState(null);
  const [returnAttempt, setReturnAttempt] = useState(0);

  useEffect(() => {
    if (!cardReturnReference) return undefined;

    if (redirectStatus === "failed") {
      setReturnState("error");
      setReturnError("Kart ödemesi tamamlanmadı. Yeni bir ödeme oturumu başlatman gerekiyor.");
      return undefined;
    }

    if (redirectStatus === "processing") {
      setReturnState("processing");
      setReturnError("");
      return undefined;
    }

    let active = true;
    setReturnState("loading");
    setReturnError("");

    finalizeCardPayment(cardReturnReference)
      .then((booking) => {
        if (!active) return;
        setReturnBooking(booking);
        setReturnState(booking?.status === "confirmed" ? "success" : "processing");
      })
      .catch((paymentError) => {
        if (!active) return;
        setReturnState("error");
        setReturnError(
          paymentError.message ||
            "Ödeme dönüşü alındı ancak rezervasyon henüz tamamlanamadı.",
        );
      });

    return () => {
      active = false;
    };
  }, [cardReturnReference, redirectStatus, returnAttempt]);

  const hotel = state?.hotel;
  const prebook = state?.prebook;
  const offer = state?.offer || hotel?.offer;
  const adults = Math.max(Number(state?.adults) || 1, 1);
  const [form, setForm] = useState(() => ({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    guests: [{ firstName: "", lastName: "" }],
  }));
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [submitState, setSubmitState] = useState("idle");
  const [error, setError] = useState("");
  const [cryptoBooking, setCryptoBooking] = useState(null);
  const [cardSession, setCardSession] = useState(null);

  const hotelName = hotel?.name || hotel?.hotelName || "Seçilen otel";
  const price = Number(
    cardSession?.amount ??
      prebook?.sellingPriceToUser ??
      prebook?.suggestedSellingPrice?.amount ??
      hotel?.offer?.suggestedSellingPrice?.amount ??
      0,
  );
  const currency =
    cardSession?.currency ||
    prebook?.currency ||
    hotel?.offer?.suggestedSellingPrice?.currency ||
    "EUR";

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
      const primaryGuest = form.guests[0];
      const guests = [{
        ...primaryGuest,
        email: form.email,
        occupancyNumber: 1,
      }];

      if (paymentMethod === "card") {
        const result = await createCardPaymentSession({
          offerId: offer.offerId,
          holder,
          guests,
        });
        setCardSession(result.paymentSession);
        setSubmitState("success");
        return;
      }

      const result = await createTravelCheckout({ offerId: offer.offerId, holder, guests });
      setCryptoBooking(result);
      setSubmitState("success");
    } catch (bookingError) {
      setSubmitState("error");
      setError(bookingError.message || "Rezervasyon şu anda tamamlanamadı.");
    }
  }

  if (isCardReturn) {
    if (returnBooking?.status === "confirmed" || returnState === "success") {
      return (
        <main className="travelCheckoutState travelCheckoutState--success">
          <CheckCircle2 size={46} />
          <h1>Rezervasyon onaylandı</h1>
          <p>Kart ödemen ve Rotavoy rezervasyonun başarıyla tamamlandı.</p>
          <strong>Referans: {returnBooking?.clientReference || cardReturnReference}</strong>
          <Link to="/travel">Yeni otel ara</Link>
        </main>
      );
    }

    if (returnState === "error") {
      return (
        <main className="travelCheckoutState">
          <AlertCircle size={38} />
          <h1>Rezervasyon tamamlanamadı</h1>
          <p>{returnError}</p>
          <strong>Referans: {cardReturnReference}</strong>
          <button
            className="travelCheckoutRetry"
            type="button"
            onClick={() => setReturnAttempt((value) => value + 1)}
          >
            Tekrar kontrol et
          </button>
          <Link to="/travel">Otel aramasına dön</Link>
        </main>
      );
    }

    return (
      <main className="travelCheckoutState">
        <LoaderCircle className="travelSpin" size={38} />
        <h1>{returnState === "processing" ? "Ödeme işleniyor" : "Rezervasyon tamamlanıyor"}</h1>
        <p>Kart ödemeni doğrulayıp Rotavoy rezervasyonunu tamamlıyoruz.</p>
        <strong>Referans: {cardReturnReference}</strong>
      </main>
    );
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

  if (cryptoBooking?.status === "confirmed") {
    return (
      <main className="travelCheckoutState travelCheckoutState--success">
        <CheckCircle2 size={42} />
        <h1>Rezervasyon onaylandı</h1>
        <p>{hotelName} için USDT ödemen ve Rotavoy rezervasyonun başarıyla onaylandı.</p>
        <strong>Referans: {cryptoBooking.clientReference}</strong>
        <Link to="/travel">Yeni otel ara</Link>
      </main>
    );
  }

  const cardReturnUrl = cardSession
    ? `${window.location.origin}/travel/checkout?cardRef=${encodeURIComponent(cardSession.clientReference)}`
    : "";

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
            <p className="travelCheckoutLead">
              Bilgileri kontrol et. Oda ve toplam fiyat yeniden doğrulanır; ardından kart veya USDT ile güvenli ödeme adımına geçersin.
            </p>

            {cardSession ? (
              <NuiteeCardPayment session={cardSession} returnUrl={cardReturnUrl} />
            ) : cryptoBooking ? (
              <CryptoPayment
                booking={cryptoBooking}
                onBookingUpdated={setCryptoBooking}
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
                  <h2>Oda ana misafiri</h2>
                  <p className="travelCheckoutSecurity">
                    Rezervasyon sistemi oda başına bir ana misafir ister. {adults} yetişkin bilgisi rezervasyonda korunur.
                  </p>
                  {form.guests.map((guest, index) => (
                    <div className="travelCheckoutFormGrid" key={index}>
                      <strong className="travelCheckoutWide">Oda 1</strong>
                      <label>Ad<input required value={guest.firstName} onChange={(event) => updateGuest(index, "firstName", event.target.value)} /></label>
                      <label>Soyad<input required value={guest.lastName} onChange={(event) => updateGuest(index, "lastName", event.target.value)} /></label>
                    </div>
                  ))}
                </div>

                <div className="travelPaymentChoice" role="group" aria-label="Ödeme yöntemi">
                  <button
                    type="button"
                    className={paymentMethod === "card" ? "travelPaymentOption travelPaymentOption--active" : "travelPaymentOption"}
                    onClick={() => setPaymentMethod("card")}
                  >
                    <CreditCard size={21} />
                    <span><strong>Kart / Cüzdan</strong><small>Rotavoy · 3D Secure destekli</small></span>
                  </button>
                  <button
                    type="button"
                    className={paymentMethod === "crypto" ? "travelPaymentOption travelPaymentOption--active" : "travelPaymentOption"}
                    onClick={() => setPaymentMethod("crypto")}
                  >
                    <WalletCards size={21} />
                    <span><strong>USDT</strong><small>BNB Chain · zincir doğrulamalı</small></span>
                  </button>
                </div>

                {error && <p className="travelCheckoutError"><AlertCircle size={17} /> {error}</p>}
                <button className="travelCheckoutSubmit" disabled={submitState === "loading"} type="submit">
                  {submitState === "loading" ? <LoaderCircle className="travelSpin" size={19} /> : <LockKeyhole size={18} />}
                  {submitState === "loading"
                    ? "Fiyat ve oda doğrulanıyor"
                    : paymentMethod === "card"
                      ? "Güvenli kart ödeme formunu aç"
                      : "USDT ödeme adımına geç"}
                </button>
                <p className="travelCheckoutSecurity">
                  <ShieldCheck size={16} />
                  {paymentMethod === "card"
                    ? "Kart bilgileri Rotavoy sunucusuna girmez; güvenli ödeme altyapısında işlenir."
                    : "Rezervasyon yalnızca USDT transferi zincirde doğrulandıktan sonra oluşturulur."}
                </p>
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
              {cardSession && <div><dt>Ödeme</dt><dd>Kart · Rotavoy</dd></div>}
            </dl>
            <div className="travelCheckoutTotal">
              <span>{cardSession ? "Kartla çekilecek toplam" : "Toplam konaklama"}</span>
              <strong>{money(price, currency)}</strong>
            </div>
            {cardSession && (
              <p className="travelCheckoutPriceVerified">Fiyat ödeme öncesi yeniden doğrulandı.</p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

export default TravelCheckout;
