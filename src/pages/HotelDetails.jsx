import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BedDouble,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Hotel,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Star,
  UsersRound,
  Wifi,
} from "lucide-react";

import {
  getHotelDetails,
  prebookHotel,
  searchHotelRates,
} from "../services/hotelsApi";
import "./HotelDetails.css";

function money(amount, currency = "EUR") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function unwrapHotel(payload) {
  return payload?.data?.hotel || payload?.data || payload?.hotel || payload || {};
}

function collectImages(value, result = [], seen = new Set()) {
  if (!value || result.length >= 40) return result;

  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) && /\.(jpe?g|png|webp)(\?|$)/i.test(value) && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImages(item, result, seen));
    return result;
  }

  if (typeof value === "object") {
    const preferred = ["urlHd", "url", "image", "src", "link", "thumbnail"];
    preferred.forEach((key) => collectImages(value[key], result, seen));
    Object.entries(value)
      .filter(([key]) => !preferred.includes(key) && /image|photo|picture|gallery/i.test(key))
      .forEach(([, nested]) => collectImages(nested, result, seen));
  }

  return result;
}

function textList(value) {
  if (!value) return [];
  const source = Array.isArray(value) ? value : Object.values(value);
  return source
    .flatMap((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return [];
      return item.name || item.facilityName || item.description || item.title || [];
    })
    .filter(Boolean)
    .map(String)
    .slice(0, 24);
}

function buildOffers(rateResponse) {
  const result = rateResponse?.data?.[0];
  return (result?.roomTypes || [])
    .filter((room) => room?.offerId && room?.suggestedSellingPrice?.amount)
    .sort(
      (left, right) =>
        Number(left.suggestedSellingPrice.amount) -
        Number(right.suggestedSellingPrice.amount),
    );
}

function HotelDetails() {
  const { hotelId } = useParams();
  const [searchParams] = useSearchParams();
  const checkin = searchParams.get("checkin") || "";
  const checkout = searchParams.get("checkout") || "";
  const adults = Math.min(Math.max(Number(searchParams.get("adults")) || 2, 1), 10);

  const [hotel, setHotel] = useState(null);
  const [offers, setOffers] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [bookingState, setBookingState] = useState("idle");
  const [bookingError, setBookingError] = useState("");
  const [prebook, setPrebook] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      setError("");

      try {
        const [details, rates] = await Promise.all([
          getHotelDetails(hotelId),
          checkin && checkout
            ? searchHotelRates({
                hotelIds: [hotelId],
                checkin,
                checkout,
                adults,
              })
            : Promise.resolve(null),
        ]);

        if (cancelled) return;
        setHotel(unwrapHotel(details));
        setOffers(buildOffers(rates));
        setState("success");
      } catch (loadError) {
        if (cancelled) return;
        setState("error");
        setError(loadError.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [hotelId, checkin, checkout, adults]);

  const images = useMemo(() => collectImages(hotel), [hotel]);
  const facilities = useMemo(
    () => textList(hotel?.facilities || hotel?.amenities || hotel?.hotelFacilities),
    [hotel],
  );
  const name = hotel?.name || hotel?.hotelName || "Otel";
  const address =
    hotel?.address ||
    hotel?.hotelAddress ||
    [hotel?.city, hotel?.country].filter(Boolean).join(", ");
  const stars = hotel?.stars || hotel?.starRating || hotel?.rating || 0;
  const description =
    hotel?.description ||
    hotel?.hotelDescription ||
    "Bu otelin ayrıntıları ve müsait oda seçenekleri aşağıda yer alıyor.";

  async function handlePrebook(offer) {
    setBookingState("loading");
    setBookingError("");
    setPrebook(null);

    try {
      const response = await prebookHotel(offer.offerId);
      setPrebook(response);
      setBookingState("success");
    } catch (bookingFailure) {
      setBookingState("error");
      setBookingError(
        /no availability|not available/i.test(bookingFailure.message)
          ? "Bu oda az önce tükendi. Lütfen diğer oda seçeneğini dene."
          : bookingFailure.message,
      );
    }
  }

  if (state === "loading") {
    return (
      <main className="hotelDetailState">
        <LoaderCircle className="travelSpin" size={30} />
        <p>Otel ayrıntıları hazırlanıyor…</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="hotelDetailState hotelDetailState--error">
        <AlertCircle size={30} />
        <h1>Otel ayrıntıları açılamadı</h1>
        <p>{error}</p>
        <Link to="/travel">Otel aramasına dön</Link>
      </main>
    );
  }

  return (
    <main className="hotelDetailPage">
      <div className="hotelDetailContainer">
        <Link className="hotelDetailBack" to="/travel">
          <ArrowLeft size={18} /> Arama sonuçlarına dön
        </Link>

        <section className="hotelDetailHeader">
          <div>
            <span className="hotelDetailStars">
              <Star size={16} fill="currentColor" /> {stars} yıldız
            </span>
            <h1>{name}</h1>
            {address && (
              <p>
                <MapPin size={17} /> {address}
              </p>
            )}
          </div>
          {checkin && checkout && (
            <div className="hotelDetailStay">
              <strong>{checkin} → {checkout}</strong>
              <span><UsersRound size={15} /> {adults} yetişkin</span>
            </div>
          )}
        </section>

        <section className="hotelGallery">
          <div className="hotelGalleryMain">
            {images.length ? (
              <img src={images[activeImage]} alt={`${name} fotoğrafı ${activeImage + 1}`} />
            ) : (
              <Hotel size={64} aria-hidden="true" />
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="hotelGalleryArrow hotelGalleryArrow--left"
                  onClick={() => setActiveImage((activeImage - 1 + images.length) % images.length)}
                  aria-label="Önceki fotoğraf"
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  className="hotelGalleryArrow hotelGalleryArrow--right"
                  onClick={() => setActiveImage((activeImage + 1) % images.length)}
                  aria-label="Sonraki fotoğraf"
                >
                  <ChevronRight />
                </button>
                <span className="hotelGalleryCount">{activeImage + 1} / {images.length}</span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="hotelGalleryThumbs">
              {images.slice(0, 12).map((image, index) => (
                <button
                  type="button"
                  key={image}
                  className={index === activeImage ? "active" : ""}
                  onClick={() => setActiveImage(index)}
                  aria-label={`Fotoğraf ${index + 1}`}
                >
                  <img src={image} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="hotelDetailColumns">
          <div className="hotelDetailMain">
            <section className="hotelDetailCard">
              <h2>Otel hakkında</h2>
              <p className="hotelDescription">{description}</p>
            </section>

            <section className="hotelDetailCard">
              <h2>Olanaklar</h2>
              {facilities.length ? (
                <div className="hotelFacilities">
                  {facilities.map((facility) => (
                    <span key={facility}><Wifi size={16} /> {facility}</span>
                  ))}
                </div>
              ) : (
                <p className="hotelMuted">Olanak bilgileri henüz listelenmemiş.</p>
              )}
            </section>
          </div>

          <aside className="hotelDetailBooking">
            <div className="hotelDetailCard">
              <span className="hotelDetailEyebrow">MÜSAİT ODALAR</span>
              <h2>Konaklamanı seç</h2>

              {!checkin || !checkout ? (
                <p className="hotelMuted">Fiyatları görmek için arama sayfasından tarih seç.</p>
              ) : offers.length ? (
                <div className="hotelOffers">
                  {offers.map((offer) => (
                    <article key={offer.offerId} className="hotelOffer">
                      <div>
                        <BedDouble size={19} />
                        <strong>{offer?.rates?.[0]?.name || "Müsait oda"}</strong>
                      </div>
                      <span>Toplam konaklama fiyatı</span>
                      <b>
                        {money(
                          offer.suggestedSellingPrice.amount,
                          offer.suggestedSellingPrice.currency,
                        )}
                      </b>
                      <button
                        type="button"
                        onClick={() => handlePrebook(offer)}
                        disabled={bookingState === "loading"}
                      >
                        {bookingState === "loading" ? (
                          <><LoaderCircle className="travelSpin" size={17} /> Hazırlanıyor</>
                        ) : (
                          "Rezervasyon yap"
                        )}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="hotelMuted">Bu tarihler için müsait oda bulunamadı.</p>
              )}

              {bookingState === "error" && (
                <p className="hotelBookingMessage hotelBookingMessage--error">
                  <AlertCircle size={18} /> {bookingError}
                </p>
              )}
              {bookingState === "success" && prebook?.data && (
                <div className="hotelBookingMessage hotelBookingMessage--success">
                  <CheckCircle2 size={21} />
                  <div>
                    <strong>Rezervasyona hazır</strong>
                    <span>
                      {money(prebook.data.sellingPriceToUser, prebook.data.currency)}
                      {" · "}Toplam konaklama fiyatı
                    </span>
                  </div>
                </div>
              )}

              <p className="hotelSecureNote">
                <ShieldCheck size={16} /> Son fiyat rezervasyon öncesinde yeniden doğrulanır.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default HotelDetails;
