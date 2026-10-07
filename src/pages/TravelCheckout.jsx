import { rateTerms, changedTerms, mergeTerms } from "../../shared/hotelRate.js";
import RateDetails from "../components/Hotels/RateDetails.jsx";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { accountRequest } from "../services/customerApi";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import ReservationResult from "../components/ReservationResult";
import CryptoPayment from "../components/CryptoPayment/CryptoPayment";
import NuiteeCardPayment from "../components/NuiteeCardPayment/NuiteeCardPayment";
import {
  createCardPaymentSession,
  createTravelCheckout,
  finalizeCardPayment,
  getTravelReservation,
  verifyTravelPayment,
} from "../services/hotelsApi";
import "./TravelCheckout.css";

const NETWORK_LABELS = {
  BSC: "BNB Chain",
  ETH: "Ethereum",
};

const CRYPTO_ASSETS = [
  { symbol: "USDT", networks: ["BSC", "ETH"] },
  { symbol: "USDC", networks: ["BSC", "ETH"] },
  { symbol: "BNB", networks: ["BSC"] },
  { symbol: "ETH", networks: ["ETH"] },
];

function money(amount, currency = "EUR") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function TravelCheckout() {
  const { customerSession } = useCustomerAuth();
  const [savedTravelers, setSavedTravelers] = useState([]);
  const [travelerError, setTravelerError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setSavedTravelers([]); setTravelerError("");
    if (customerSession?.token) accountRequest("/preferences", { signal: controller.signal }).then(data => setSavedTravelers(data.travelers)).catch(e => { if (e.name !== "AbortError") setTravelerError(e.message); });
    return () => controller.abort();
  }, [customerSession?.token]);
  const location = useLocation();
  const { state } = location;
  const returnParams = new URLSearchParams(location.search);
  const cardReturnReference = returnParams.get("cardRef") || returnParams.get("bookingRef") || "";
  const isCardReturn = Boolean(cardReturnReference);
  const isCardPaymentReturn = Boolean(returnParams.get("cardRef"));

  const [returnState, setReturnState] = useState("idle");
  const [returnError, setReturnError] = useState("");
  const [returnBooking, setReturnBooking] = useState(null);
  const [returnAttempt, setReturnAttempt] = useState(0);

  useEffect(() => {
    if (!cardReturnReference) return undefined;

    let active = true, timer, polls = 0;
    setReturnState("loading"); setReturnError("");
    async function check(initial = false) {
      try {
        const booking = initial && isCardPaymentReturn
          ? await finalizeCardPayment(cardReturnReference)
          : await getTravelReservation(cardReturnReference);
        if (!active) return;
        setReturnBooking(booking);
        setReturnState(booking.status === "confirmed" ? "success" : "processing");
        if (booking.status === "processing" && ++polls < 30) timer = setTimeout(() => check(), 6000);
      } catch (e) { if (active) { setReturnState("error"); setReturnError(e.message); } }
    }
    check(true);
    return () => { active = false; clearTimeout(timer); };
  }, [cardReturnReference, isCardPaymentReturn, returnAttempt]);

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
  const [cryptoAsset, setCryptoAsset] = useState("USDT");
  const [cryptoNetwork, setCryptoNetwork] = useState("BSC");
  const [networkPickerOpen, setNetworkPickerOpen] = useState(null);
  const [submitState, setSubmitState] = useState("idle");
  const [error, setError] = useState("");
  const [cryptoBooking, setCryptoBooking] = useState(null);
  const [cardSession, setCardSession] = useState(null);
  const [confirmedTerms, setConfirmedTerms] = useState(() => mergeTerms(rateTerms(offer), rateTerms(prebook, true)));
  const [rateChanges, setRateChanges] = useState(() => [...new Set([...changedTerms(rateTerms(offer), rateTerms(prebook, true)), ...(prebook?.boardChanged ? ['Yemek planı'] : []), ...(prebook?.cancellationChanged ? ['İptal koşulları'] : [])])]);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const selectedCryptoAsset =
    CRYPTO_ASSETS.find((asset) => asset.symbol === cryptoAsset) ||
    CRYPTO_ASSETS[0];
  const selectedNetworkKey = selectedCryptoAsset.networks.includes(cryptoNetwork)
    ? cryptoNetwork
    : selectedCryptoAsset.networks[0];
  const selectedNetwork = NETWORK_LABELS[selectedNetworkKey];

  const confirmedHotelId = prebook?.hotelId || hotel?.hotelId || hotel?.id;
  const hotelName = hotel?.name || hotel?.hotelName || "Seçilen otel";
  const price = Number(
    cardSession?.amount ??
      confirmedTerms?.total ??
      prebook?.sellingPriceToUser ??
      prebook?.suggestedSellingPrice?.amount ??
      hotel?.offer?.suggestedSellingPrice?.amount ??
      0
  );
  const currency =
    cardSession?.currency ||
    confirmedTerms?.currency ||
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
        guestIndex === index ? { ...guest, [field]: value } : guest
      ),
    }));
  }

  function selectCryptoAsset(asset) {
    setCryptoAsset(asset.symbol);

    if (asset.networks.length === 1) {
      setCryptoNetwork(asset.networks[0]);
      setNetworkPickerOpen(null);
      return;
    }

    if (!asset.networks.includes(cryptoNetwork)) {
      setCryptoNetwork(asset.networks[0]);
    }

    setNetworkPickerOpen((current) =>
      current === asset.symbol ? null : asset.symbol
    );
  }

  function selectCryptoNetwork(networkKey) {
    setCryptoNetwork(networkKey);
    setNetworkPickerOpen(null);
  }

  async function submit(event) {
    event.preventDefault();
    if (!offer?.offerId || submitState === "loading" || (rateChanges.length && !termsAccepted)) return;

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
      const guests = [
        {
          ...primaryGuest,
          email: form.email,
          occupancyNumber: 1,
        },
      ];

      const stay = { hotelId: confirmedHotelId, hotelName, checkin: state.checkin, checkout: state.checkout, adults: state.adults };
      if (paymentMethod === "card") {
        const result = await createCardPaymentSession({
          stay,
          acceptedTerms: confirmedTerms,
          offerId: offer.offerId,
          holder,
          guests,
        });
        setCardSession(result.paymentSession);
        setSubmitState("success");
        return;
      }

      const result = await createTravelCheckout({
        stay,
        acceptedTerms: confirmedTerms,
        offerId: offer.offerId,
        holder,
        guests,
        cryptoAsset,
        cryptoNetwork: selectedNetworkKey,
      });
      setCryptoBooking(result);
      setSubmitState("success");
    } catch (bookingError) {
      if (bookingError.code === 'RATE_CHANGED') {
        setConfirmedTerms(bookingError.confirmedTerms);
        setRateChanges(bookingError.changes?.length ? bookingError.changes : ['Fiyat ve koşullar']);
        setTermsAccepted(false);
      }
      setSubmitState("error");
      setError(
        bookingError.message || "Rezervasyon şu anda tamamlanamadı."
      );
    }
  }

  if (isCardReturn) return <main className="travelCheckoutState">{returnError && <p role="alert">{returnError}</p>}{returnBooking ? <ReservationResult booking={returnBooking} onRefresh={() => setReturnAttempt(v => v + 1)} /> : <><h1>{returnState === "error" ? "Rezervasyon kontrol edilemedi" : "Rezervasyon kontrol ediliyor"}</h1><strong>Referans: {cardReturnReference}</strong><button onClick={() => setReturnAttempt(v => v + 1)}>Durumu kontrol et</button></>}</main>;

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

  if (cryptoBooking?.status === "confirmed" || cryptoBooking?.paymentStatus === "paid") return <main className="travelCheckoutState"><ReservationResult booking={cryptoBooking} onRefresh={async () => { try { setCryptoBooking(await getTravelReservation(cryptoBooking.clientReference)); } catch (e) { setError(e.message); } }} />{error && <p role="alert">{error}</p>}<Link to={`/travel/checkout?bookingRef=${encodeURIComponent(cryptoBooking.clientReference)}`}>Rezervasyon durum sayfasını aç</Link></main>;

  const cardReturnUrl = cardSession
    ? `${window.location.origin}/travel/checkout?cardRef=${encodeURIComponent(
        cardSession.clientReference
      )}`
    : "";

  return (
    <main className="travelCheckoutPage">
      <div className="travelCheckoutContainer">
        <Link
          className="travelCheckoutBack"
          to={`/travel/hotels/${encodeURIComponent(hotel.hotelId)}`}
        >
          <ArrowLeft size={18} /> Otele dön
        </Link>

        <div className="travelCheckoutGrid">
          <section>
            <span className="travelCheckoutEyebrow">GÜVENLİ REZERVASYON</span>
            <h1>Misafir bilgileri</h1>
            <p className="travelCheckoutLead">
              Bilgileri kontrol et. Oda ve toplam fiyat yeniden doğrulanır;
              ardından kart veya kripto ile güvenli ödeme adımına geçersin.
            </p>

            {cardSession ? (
              <NuiteeCardPayment
                session={cardSession}
                returnUrl={cardReturnUrl}
              />
            ) : cryptoBooking ? (
              <CryptoPayment
                booking={cryptoBooking}
                onBookingUpdated={setCryptoBooking}
                verifyPaymentRequest={verifyTravelPayment}
                forceDisplay
              />
            ) : (
              <form onSubmit={submit} className="travelCheckoutForm">
                {rateChanges.length > 0 && <div className="travelRateChange" role="alert"><strong>{rateChanges.join(', ')} güncellendi</strong><p>Güncel toplam: {money(confirmedTerms.total, confirmedTerms.currency)}. Ödemeden önce aşağıdaki koşulları incele.</p><RateDetails terms={confirmedTerms} /><label><input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} /> Güncel fiyat ve koşulları kabul ediyorum</label></div>}

                {savedTravelers.length > 0 && <label className="checkoutSavedTraveler">Kayıtlı yolcu bilgilerini kullan<select defaultValue="" onChange={event => { const person = savedTravelers.find(p => p._id === event.target.value); if (!person) return; setForm(current => ({ ...current, firstName: person.firstName, lastName: person.lastName, email: person.email || current.email, phone: person.phone || current.phone, guests: current.guests.map((g, i) => i === 0 ? { ...g, firstName: person.firstName, lastName: person.lastName } : g) })); }}><option value="">Yolcu seç</option>{savedTravelers.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></label>}
                {travelerError && <p role="status">Kayıtlı yolcular yüklenemedi. Bilgilerini aşağıdan doldurabilirsin.</p>}
                <div className="travelCheckoutFormGrid">
                  <label>
                    Ad
                    <input
                      required
                      value={form.firstName}
                      onChange={(event) =>
                        updateField("firstName", event.target.value)
                      }
                      autoComplete="given-name"
                    />
                  </label>
                  <label>
                    Soyad
                    <input
                      required
                      value={form.lastName}
                      onChange={(event) =>
                        updateField("lastName", event.target.value)
                      }
                      autoComplete="family-name"
                    />
                  </label>
                  <label className="travelCheckoutWide">
                    E-posta
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField("email", event.target.value)
                      }
                      autoComplete="email"
                    />
                  </label>
                  <label className="travelCheckoutWide">
                    Telefon
                    <input
                      required
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        updateField("phone", event.target.value)
                      }
                      autoComplete="tel"
                    />
                  </label>
                </div>

                <div className="travelGuestFields">
                  <h2>Oda ana misafiri</h2>
                  <p className="travelCheckoutSecurity">
                    Rezervasyon sistemi oda başına bir ana misafir ister.{" "}
                    {adults} yetişkin bilgisi rezervasyonda korunur.
                  </p>

                  {form.guests.map((guest, index) => (
                    <div className="travelCheckoutFormGrid" key={index}>
                      <strong className="travelCheckoutWide">Oda 1</strong>
                      <label>
                        Ad
                        <input
                          required
                          value={guest.firstName}
                          onChange={(event) =>
                            updateGuest(index, "firstName", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Soyad
                        <input
                          required
                          value={guest.lastName}
                          onChange={(event) =>
                            updateGuest(index, "lastName", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>

                <div
                  className="travelPaymentChoice"
                  role="group"
                  aria-label="Ödeme yöntemi"
                >
                  <button
                    type="button"
                    className={
                      paymentMethod === "card"
                        ? "travelPaymentOption travelPaymentOption--active"
                        : "travelPaymentOption"
                    }
                    onClick={() => setPaymentMethod("card")}
                  >
                    <CreditCard size={21} />
                    <span>
                      <strong>Kart / Cüzdan</strong>
                      <small>Rotavoy · 3D Secure destekli</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={
                      paymentMethod === "crypto"
                        ? "travelPaymentOption travelPaymentOption--active"
                        : "travelPaymentOption"
                    }
                    onClick={() => setPaymentMethod("crypto")}
                  >
                    <WalletCards size={21} />
                    <span>
                      <strong>Kripto</strong>
                      <small>USDT · USDC · BNB · ETH</small>
                    </span>
                  </button>
                </div>

                {paymentMethod === "crypto" && (
                  <div className="travelCryptoPicker">
                    <div
                      className="travelCryptoAssetChoice"
                      role="group"
                      aria-label="Kripto ödeme birimi"
                    >
                      {CRYPTO_ASSETS.map((asset) => {
                        const isSelected = cryptoAsset === asset.symbol;
                        const hasNetworkChoice = asset.networks.length > 1;
                        const assetNetworkKey = isSelected
                          ? selectedNetworkKey
                          : asset.networks[0];

                        return (
                          <button
                            key={asset.symbol}
                            type="button"
                            className={
                              isSelected
                                ? "travelCryptoAsset travelCryptoAsset--active"
                                : "travelCryptoAsset"
                            }
                            onClick={() => selectCryptoAsset(asset)}
                            aria-expanded={
                              hasNetworkChoice
                                ? networkPickerOpen === asset.symbol
                                : undefined
                            }
                          >
                            <span className="travelCryptoAssetText">
                              <strong>{asset.symbol}</strong>
                              <small>{NETWORK_LABELS[assetNetworkKey]}</small>
                            </span>
                            {hasNetworkChoice && (
                              <ChevronDown
                                className={
                                  networkPickerOpen === asset.symbol
                                    ? "travelCryptoChevron travelCryptoChevron--open"
                                    : "travelCryptoChevron"
                                }
                                size={17}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {networkPickerOpen &&
                      ["USDT", "USDC"].includes(networkPickerOpen) && (
                        <div className="travelCryptoNetworkPicker">
                          <span>{networkPickerOpen} için ağ seç</span>
                          <div
                            className="travelCryptoNetworkOptions"
                            role="group"
                            aria-label={`${networkPickerOpen} ağı`}
                          >
                            {["BSC", "ETH"].map((networkKey) => (
                              <button
                                key={networkKey}
                                type="button"
                                className={
                                  cryptoAsset === networkPickerOpen &&
                                  selectedNetworkKey === networkKey
                                    ? "travelCryptoNetwork travelCryptoNetwork--active"
                                    : "travelCryptoNetwork"
                                }
                                onClick={() => {
                                  setCryptoAsset(networkPickerOpen);
                                  selectCryptoNetwork(networkKey);
                                }}
                              >
                                <strong>{NETWORK_LABELS[networkKey]}</strong>
                                <small>
                                  {networkKey === "BSC"
                                    ? "BNB ile gas"
                                    : "ETH ile gas"}
                                </small>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {error && (
                  <p className="travelCheckoutError">
                    <AlertCircle size={17} /> {error}
                  </p>
                )}

                <button
                  className="travelCheckoutSubmit"
                  disabled={submitState === "loading" || (rateChanges.length > 0 && !termsAccepted)}
                  type="submit"
                >
                  {submitState === "loading" ? (
                    <LoaderCircle className="travelSpin" size={19} />
                  ) : (
                    <LockKeyhole size={18} />
                  )}
                  {submitState === "loading"
                    ? "Fiyat ve oda doğrulanıyor"
                    : paymentMethod === "card"
                      ? "Güvenli kart ödeme formunu aç"
                      : `${cryptoAsset} · ${selectedNetwork} ödeme adımına geç`}
                </button>

                <p className="travelCheckoutSecurity">
                  <ShieldCheck size={16} />
                  {paymentMethod === "card"
                    ? "Kart bilgileri Rotavoy sunucusuna girmez; güvenli ödeme altyapısında işlenir."
                    : `Rezervasyon yalnızca ${cryptoAsset} transferi ${selectedNetwork} ağında zincirde doğrulandıktan sonra oluşturulur.`}
                </p>
              </form>
            )}
          </section>

          <aside className="travelCheckoutSummary">
            <span>REZERVASYON ÖZETİ</span>
            <h2>{hotelName}</h2>
            <dl>
              <div>
                <dt>Giriş</dt>
                <dd>{state.checkin}</dd>
              </div>
              <div>
                <dt>Çıkış</dt>
                <dd>{state.checkout}</dd>
              </div>
              <div>
                <dt>Misafir</dt>
                <dd>{adults} yetişkin</dd>
              </div>
              {cardSession && (
                <div>
                  <dt>Ödeme</dt>
                  <dd>Kart · Rotavoy</dd>
                </div>
              )}
              {!cardSession &&
                !cryptoBooking &&
                paymentMethod === "crypto" && (
                  <div>
                    <dt>Kripto</dt>
                    <dd>
                      {cryptoAsset} · {selectedNetwork}
                    </dd>
                  </div>
                )}
              {cryptoBooking && (
                <div>
                  <dt>Ödeme</dt>
                  <dd>
                    {cryptoBooking.payment?.token} ·{" "}
                    {cryptoBooking.payment?.network}
                  </dd>
                </div>
              )}
            </dl>

            {rateChanges.length === 0 && <RateDetails terms={confirmedTerms} />}

            <div className="travelCheckoutTotal">
              <span>
                {cardSession
                  ? "Kartla çekilecek toplam"
                  : "Toplam konaklama"}
              </span>
              <strong>{money(price, currency)}</strong>
            </div>

            {cardSession && (
              <p className="travelCheckoutPriceVerified">
                Fiyat ödeme öncesi yeniden doğrulandı.
              </p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

export default TravelCheckout;
