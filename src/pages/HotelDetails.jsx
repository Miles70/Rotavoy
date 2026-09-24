import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BedDouble,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleParking,
  ConciergeBell,
  Dumbbell,
  Hotel,
  Languages,
  LoaderCircle,
  MapPin,
  Martini,
  ShieldCheck,
  Snowflake,
  Star,
  Sun,
  Trees,
  UsersRound,
  Utensils,
  Waves,
  Wifi,
} from "lucide-react";

import {
  getHotelDetails,
  prebookHotel,
  searchHotelRates,
} from "../services/hotelsApi";
import "./HotelDetails.css";

const facilityTranslations = new Map([
  ["wifi available", "Wi‑Fi"],
  ["free wifi", "Ücretsiz Wi‑Fi"],
  ["parking", "Otopark"],
  ["free parking", "Ücretsiz otopark"],
  ["heating", "Isıtma"],
  ["family rooms", "Aile odaları"],
  ["garden", "Bahçe"],
  ["lift / elevator", "Asansör"],
  ["elevator", "Asansör"],
  ["luggage storage", "Bagaj muhafazası"],
  ["express check-in/check-out", "Hızlı giriş ve çıkış"],
  ["safety deposit box", "Emanet kasası"],
  ["bar", "Bar"],
  ["car hire", "Araç kiralama"],
  ["non-smoking throughout", "Sigara içilmeyen alan"],
  ["outdoor pool", "Açık yüzme havuzu"],
  ["outdoor pool - seasonal", "Sezonluk açık havuz"],
  ["daily housekeeping", "Günlük temizlik"],
  ["pool bar", "Havuz barı"],
  ["sun loungers or beach chairs", "Şezlong"],
  ["wine/champagne", "Şarap ve şampanya"],
  ["restaurant", "Restoran"],
  ["air conditioning", "Klima"],
  ["airport shuttle", "Havalimanı transferi"],
  ["fitness centre", "Fitness merkezi"],
  ["fitness center", "Fitness merkezi"],
  ["24-hour front desk", "24 saat resepsiyon"],
  ["room service", "Oda servisi"],
  ["languages spoken", "Yabancı dil desteği"],
]);

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
    const looksLikeImage =
      /^https?:\/\//i.test(value) &&
      (/\.(jpe?g|png|webp)(\?|$)/i.test(value) ||
        /image|photo|picture|cdn/i.test(value));

    if (looksLikeImage && !seen.has(value)) {
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
      .filter(
        ([key]) =>
          !preferred.includes(key) && /image|photo|picture|gallery/i.test(key),
      )
      .forEach(([, nested]) => collectImages(nested, result, seen));
  }

  return result;
}

function textList(value) {
  if (!value) return [];
  const source = Array.isArray(value) ? value : Object.values(value);

  const translated = source
    .flatMap((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return [];
      return item.name || item.facilityName || item.description || item.title || [];
    })
    .filter(Boolean)
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => facilityTranslations.get(item.toLowerCase()) || item);

  return [...new Map(translated.map((item) => [item.toLocaleLowerCase("tr"), item])).values()]
    .slice(0, 24);
}

function cleanHotelDescription(value) {
  const source = String(value || "").trim();
  if (!source) {
    return "Bu otelin ayrıntıları ve müsait oda seçenekleri aşağıda yer alıyor.";
  }

  if (typeof DOMParser !== "undefined") {
    const document = new DOMParser().parseFromString(source, "text/html");
    const blocks = [...document.querySelectorAll("p")]
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (blocks.length) return blocks.join("\n\n");
    return document.body.textContent?.replace(/\s+/g, " ").trim() || source;
  }

  return source
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

function numericValue(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
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

function facilityIcon(name) {
  const normalized = name.toLocaleLowerCase("tr");
  if (/wifi|internet/.test(normalized)) return Wifi;
  if (/otopark|parking/.test(normalized)) return CircleParking;
  if (/havuz|pool/.test(normalized)) return Waves;
  if (/bar|şarap|wine/.test(normalized)) return Martini;
  if (/restoran|restaurant/.test(normalized)) return Utensils;
  if (/araç|car hire|transfer|shuttle/.test(normalized)) return Car;
  if (/bahçe|garden/.test(normalized)) return Trees;
  if (/klima|air condition/.test(normalized)) return Snowflake;
  if (/fitness|gym/.test(normalized)) return Dumbbell;
  if (/resepsiyon|servis|temizlik|housekeeping/.test(normalized)) return ConciergeBell;
  if (/dil|language/.test(normalized)) return Languages;
  if (/şezlong|sun/.test(normalized)) return Sun;
  return CheckCircle2;
}

function HotelDetails() {
  const { hotelId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const checkin = searchParams.get("checkin") || "";
  const checkout = searchParams.get("checkout") || "";
  const adults = Math.min(
    Math.max(Number(searchParams.get("adults")) || 2, 1),
    10,
  );
  const fallbackHotel = location.state?.hotel || null;

  const [hotel, setHotel] = useState(fallbackHotel);
  const [offers, setOffers] = useState(
    fallbackHotel?.offers || (fallbackHotel?.offer ? [fallbackHotel.offer] : []),
  );
  const [activeImage, setActiveImage] = useState(0);
  const [state, setState] = useState(fallbackHotel ? "success" : "loading");
  const [error, setError] = useState("");
  const [ratesError, setRatesError] = useState("");
  const [bookingState, setBookingState] = useState("idle");
  const [bookingError, setBookingError] = useState("");
  const [prebook, setPrebook] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!fallbackHotel) setState("loading");
      setError("");
      setRatesError("");

      const detailsPromise = getHotelDetails(hotelId);
      const ratesPromise =
        checkin && checkout
          ? searchHotelRates({
              hotelIds: [hotelId],
              checkin,
              checkout,
              adults,
            })
          : Promise.resolve(null);

      const [detailsResult, ratesResult] = await Promise.allSettled([
        detailsPromise,
        ratesPromise,
      ]);

      if (cancelled) return;

      const ratePayload =
        ratesResult.status === "fulfilled" ? ratesResult.value : null;
      const rateHotel = ratePayload?.hotels?.find(
        (candidate) => candidate.id === hotelId,
      );
      const detailedHotel =
        detailsResult.status === "fulfilled"
          ? unwrapHotel(detailsResult.value)
          : null;
      const resolvedHotel =
        detailedHotel && Object.keys(detailedHotel).length
          ? { ...(fallbackHotel || {}), ...detailedHotel }
          : rateHotel || fallbackHotel;

      if (resolvedHotel) {
        setHotel(resolvedHotel);
        setState("success");
      } else {
        setState("error");
        setError(
          detailsResult.status === "rejected"
            ? detailsResult.reason?.message || "Otel bilgileri alınamadı."
            : "Otel bilgileri bulunamadı.",
        );
      }

      if (ratesResult.status === "fulfilled") {
        setOffers(buildOffers(ratePayload));
      } else {
        setRatesError(
          ratesResult.reason?.message ||
            "Müsait odalar şu anda kontrol edilemedi.",
        );
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [hotelId, checkin, checkout, adults, fallbackHotel]);

  const images = useMemo(() => {
    const collected = collectImages(hotel);
    if (fallbackHotel?.main_photo && !collected.includes(fallbackHotel.main_photo)) {
      collected.unshift(fallbackHotel.main_photo);
    }
    return collected;
  }, [hotel, fallbackHotel]);

  const facilities = useMemo(
    () =>
      textList(
        hotel?.facilities || hotel?.amenities || hotel?.hotelFacilities,
      ),
    [hotel],
  );

  const name = hotel?.name || hotel?.hotelName || "Otel";
  const address =
    hotel?.address ||
    hotel?.hotelAddress ||
    [hotel?.city, hotel?.city_name, hotel?.country].filter(Boolean).join(", ");

  const stars = Math.min(
    numericValue(
      hotel?.stars,
      hotel?.starRating,
      hotel?.hotelStarRating,
      hotel?.category,
    ),
    5,
  );
  const guestRating = numericValue(
    hotel?.reviewScore,
    hotel?.review_score,
    hotel?.rating,
  );
  const description = cleanHotelDescription(
    hotel?.description || hotel?.hotelDescription,
  );

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
            <div className="hotelDetailRatings">
              {stars > 0 && (
                <span className="hotelDetailStars">
                  <Star size={16} fill="currentColor" /> {stars} yıldız
                </span>
              )}
              {guestRating > 0 && (
                <span className="hotelDetailGuestRating">
                  Misafir puanı {guestRating.toLocaleString("tr-TR")}/10
                </span>
              )}
            </div>
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
              <img
                src={images[activeImage]}
                alt={`${name} fotoğrafı ${activeImage + 1}`}
              />
            ) : (
              <div className="hotelGalleryEmpty">
                <Hotel size={64} aria-hidden="true" />
                <span>Bu otel için fotoğraf bulunamadı</span>
              </div>
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="hotelGalleryArrow hotelGalleryArrow--left"
                  onClick={() =>
                    setActiveImage(
                      (activeImage - 1 + images.length) % images.length,
                    )
                  }
                  aria-label="Önceki fotoğraf"
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  className="hotelGalleryArrow hotelGalleryArrow--right"
                  onClick={() =>
                    setActiveImage((activeImage + 1) % images.length)
                  }
                  aria-label="Sonraki fotoğraf"
                >
                  <ChevronRight />
                </button>
                <span className="hotelGalleryCount">
                  {activeImage + 1} / {images.length}
                </span>
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
                  {facilities.map((facility) => {
                    const FacilityIcon = facilityIcon(facility);
                    return (
                      <span key={facility}>
                        <FacilityIcon size={16} /> {facility}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="hotelMuted">
                  Olanak bilgileri henüz listelenmemiş.
                </p>
              )}
            </section>
          </div>

          <aside className="hotelDetailBooking">
            <div className="hotelDetailCard">
              <span className="hotelDetailEyebrow">MÜSAİT ODALAR</span>
              <h2>Konaklamanı seç</h2>

              {!checkin || !checkout ? (
                <p className="hotelMuted">
                  Fiyatları görmek için arama sayfasından tarih seç.
                </p>
              ) : ratesError ? (
                <p className="hotelBookingMessage hotelBookingMessage--error">
                  <AlertCircle size={18} /> {ratesError}
                </p>
              ) : offers.length ? (
                <div className="hotelOffers">
                  {offers.map((offer) => (
                    <article key={offer.offerId} className="hotelOffer">
                      <div>
                        <BedDouble size={19} />
                        <strong>
                          {offer?.rates?.[0]?.name || "Müsait oda"}
                        </strong>
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
                          <>
                            <LoaderCircle className="travelSpin" size={17} />
                            Hazırlanıyor
                          </>
                        ) : (
                          "Rezervasyon yap"
                        )}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="hotelMuted">
                  Bu tarihler için müsait oda bulunamadı.
                </p>
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
                      {money(
                        prebook.data.sellingPriceToUser,
                        prebook.data.currency,
                      )}
                      {" · "}Toplam konaklama fiyatı
                    </span>
                  </div>
                </div>
              )}

              <p className="hotelSecureNote">
                <ShieldCheck size={16} /> Son fiyat rezervasyon öncesinde
                yeniden doğrulanır.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default HotelDetails;
