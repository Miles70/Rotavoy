import Seo from '../components/Seo/Seo';
import { SITE_URL } from '../../shared/travelSeo';
import { travelSeoCopy } from '../../shared/travelSeoCopy';
import { extraFacilityKeys } from "../../shared/hotelPresentation.js";
import RateConditions from "../components/RateConditions";
import HotelFavorite from "../components/HotelFavorite";
import { trackTravel } from '../services/analytics';
import { useEffect, useRef, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  getHotelTranslation,
  prebookHotel,
  searchHotelRates,
} from "../services/hotelsApi";
import { useLanguage } from "../i18n/LanguageContext";
import "./HotelDetails.css";

const facilityKeys = new Map([
  ...Object.entries(extraFacilityKeys),
  ["wifi available", "wifi"],
  ["free wifi", "freeWifi"],
  ["parking", "parking"],
  ["free parking", "freeParking"],
  ["heating", "heating"],
  ["family rooms", "familyRooms"],
  ["garden", "garden"],
  ["lift / elevator", "elevator"],
  ["elevator", "elevator"],
  ["luggage storage", "luggageStorage"],
  ["express check-in/check-out", "expressCheckin"],
  ["safety deposit box", "safetyBox"],
  ["bar", "bar"],
  ["car hire", "carHire"],
  ["non-smoking throughout", "nonSmoking"],
  ["outdoor pool", "outdoorPool"],
  ["outdoor pool - seasonal", "seasonalPool"],
  ["daily housekeeping", "housekeeping"],
  ["pool bar", "poolBar"],
  ["sun loungers or beach chairs", "loungers"],
  ["wine/champagne", "wine"],
  ["restaurant", "restaurant"],
  ["air conditioning", "airConditioning"],
  ["airport shuttle", "airportShuttle"],
  ["fitness centre", "fitness"],
  ["fitness center", "fitness"],
  ["24-hour front desk", "frontDesk"],
  ["room service", "roomService"],
  ["languages spoken", "languages"],
]);

function money(amount, currency = "EUR", language = "en") {
  return new Intl.NumberFormat(language === "pt" ? "pt-BR" : language, {
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
    const hdPreferred = [
      "urlHd",
      "urlHD",
      "hdUrl",
      "highResUrl",
      "originalUrl",
      "original",
    ];
    const fallbackPreferred = ["url", "image", "src", "link", "thumbnail"];

    const hdValues = hdPreferred
      .map((key) => value[key])
      .filter((candidate) => typeof candidate === "string" && candidate.trim());

    if (hdValues.length) {
      // When the provider sends the same photo in HD and regular/thumbnail
      // variants, keep only the HD source so blurry duplicates do not appear.
      hdValues.forEach((candidate) => collectImages(candidate, result, seen));
    } else {
      fallbackPreferred.forEach((key) =>
        collectImages(value[key], result, seen),
      );
    }

    const preferred = [...hdPreferred, ...fallbackPreferred];
    Object.entries(value)
      .filter(
        ([key]) =>
          !preferred.includes(key) && /image|photo|picture|gallery/i.test(key),
      )
      .forEach(([, nested]) => collectImages(nested, result, seen));
  }

  return result;
}

function textList(value, t) {
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
    .map((item) => {
      const key = facilityKeys.get(item.toLowerCase().replace(/\s+/g, " "));
      return key ? t(`hotelDetail.facilities.${key}`) : item;
    });

  return [...new Map(translated.map((item) => [item.toLocaleLowerCase("tr"), item])).values()]
    .slice(0, 24);
}

function cleanHotelDescription(value, fallback) {
  const source = String(value || "").trim();
  if (!source) {
    return fallback;
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

function dateAfter(value, days = 1) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function stayNights(checkin, checkout) {
  const start = new Date(`${checkin}T00:00:00.000Z`);
  const end = new Date(`${checkout}T00:00:00.000Z`);
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Number.isFinite(nights) && nights > 0 ? nights : 0;
}

function HotelStaySearch({ checkin, checkout, adults, disabled, onSearch, t }) {
  const [start, setStart] = useState(checkin);
  const [end, setEnd] = useState(checkout);
  const [guests, setGuests] = useState(adults);
  const tomorrow = dateAfter(null);
  const minimumEnd = start ? dateAfter(start) : tomorrow;

  return (
    <form className="hotelStaySearch" onSubmit={(event) => {
      event.preventDefault();
      if (start >= tomorrow && end > start) onSearch(start, end, guests);
    }}>
      <label>
        <span>{t("travelPage.search.start")}</span>
        <input type="date" required value={start} min={tomorrow} disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            setStart(value);
            if (end <= value) setEnd("");
          }} />
      </label>
      <label>
        <span>{t("travelPage.search.end")}</span>
        <input type="date" required value={end} min={minimumEnd} disabled={disabled}
          onChange={(event) => setEnd(event.target.value)} />
      </label>
      <label>
        <span>{t("travelPage.search.guests")}</span>
        <select value={guests} disabled={disabled} onChange={(event) => setGuests(Number(event.target.value))}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
            <option key={count} value={count}>{count} {t(count === 1 ? "hotelDetail.adult" : "hotelDetail.adults")}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={disabled}>{t("hotelDetail.checkAvailability")}</button>
    </form>
  );
}

function HotelDetails() {
  const { hotelId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const checkin = searchParams.get("checkin") || "";
  const checkout = searchParams.get("checkout") || "";
  const adults = Math.min(
    Math.max(Number(searchParams.get("adults")) || 2, 1),
    10,
  );
  const fallbackHotel = location.state?.hotel || null;
  const { t, language } = useLanguage();
  const nights = stayNights(checkin, checkout);
  const totalStayLabel = nights
    ? `${nights} ${t(nights === 1 ? "travelPage.runtime.nightSingular" : "travelPage.runtime.nightPlural")} · ${adults} ${t(adults === 1 ? "hotelDetail.adult" : "hotelDetail.adults")} · ${t("hotelDetail.totalPrice")}`
    : t("hotelDetail.totalPrice");

  const [hotel, setHotel] = useState(fallbackHotel);
  const [searchVersion, setSearchVersion] = useState(0);
  const ratesKey = JSON.stringify([hotelId, checkin, checkout, adults, searchVersion]);
  const [ratesResult, setRatesResult] = useState(null);
  const ratesLoading = Boolean(checkin && checkout && ratesResult?.key !== ratesKey);
  const offers = ratesResult?.key === ratesKey ? ratesResult.offers : [];
  const ratesError = ratesResult?.key === ratesKey ? ratesResult.error : "";
  const [activeImage, setActiveImage] = useState(0);
  const [state, setState] = useState(fallbackHotel ? "success" : "loading");
  const [error, setError] = useState("");
  const [bookingState, setBookingState] = useState("idle");
  const [bookingError, setBookingError] = useState("");
  const [prebook, setPrebook] = useState(null);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [localizedDescription, setLocalizedDescription] = useState("");
  const trackedHotel = useRef("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!fallbackHotel) setState("loading");
      setError("");
      setSelectedOffer(null);
      setPrebook(null);
      setBookingError("");
      setBookingState("idle");

      const detailsPromise = getHotelDetails(hotelId);
      const ratesPromise =
        checkin && checkout
          ? searchHotelRates({
              hotelIds: [hotelId],
              checkin,
              checkout,
              adults,
              maxRatesPerHotel: 10,
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
        if (trackedHotel.current !== hotelId) {
          trackedHotel.current = hotelId;
          trackTravel('hotel_view', { hotelId, hotelName: resolvedHotel.name || resolvedHotel.hotelName });
        }
        setHotel(resolvedHotel);
        setState("success");
      } else {
        setState("error");
        setError(
          detailsResult.status === "rejected"
            ? detailsResult.reason?.message || t("hotelDetail.detailsUnavailable")
            : t("hotelDetail.hotelNotFound"),
        );
      }

      if (ratesResult.status === "fulfilled") {
        setRatesResult({ key: ratesKey, offers: buildOffers(ratePayload), error: "" });
      } else if (ratesResult.status === "rejected") {
        const upstreamMessage = String(ratesResult.reason?.message || "");
        setRatesResult({
          key: ratesKey,
          offers: [],
          error: /no availability|not available/i.test(upstreamMessage)
            ? t("hotelDetail.noRooms")
            : t("hotelDetail.ratesUnavailable"),
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [hotelId, checkin, checkout, adults, fallbackHotel, t, ratesKey]);

  useEffect(() => {
    let cancelled = false;

    async function localizeDescription() {
      if (language === "en") {
        setLocalizedDescription("");
        return;
      }

      try {
        const result = await getHotelTranslation(hotelId, language);
        if (!cancelled) {
          setLocalizedDescription(String(result?.description || "").trim());
        }
      } catch {
        if (!cancelled) setLocalizedDescription("");
      }
    }

    localizeDescription();
    return () => {
      cancelled = true;
    };
  }, [hotelId, language]);

  const images = useMemo(() => {
    const galleryImages = [];
    const seen = new Set();

    const gallerySources = [
      hotel?.images,
      hotel?.photos,
      hotel?.pictures,
      hotel?.gallery,
      hotel?.hotelImages,
      hotel?.hotelPhotos,
      hotel?.media,
    ];

    for (const source of gallerySources) {
      collectImages(source, galleryImages, seen);
    }

    // Provider main_photo/thumbnail is often a smaller duplicate of a gallery
    // image. Never let it become photo #1 when a real gallery exists.
    if (galleryImages.length > 0) {
      return galleryImages;
    }

    const fallbackImages = [];
    const fallbackSeen = new Set();

    collectImages(hotel?.main_photo, fallbackImages, fallbackSeen);
    collectImages(hotel?.mainPhoto, fallbackImages, fallbackSeen);
    collectImages(fallbackHotel?.main_photo, fallbackImages, fallbackSeen);
    collectImages(fallbackHotel?.mainPhoto, fallbackImages, fallbackSeen);

    if (fallbackImages.length > 0) {
      return fallbackImages;
    }

    // Last-resort discovery for unusual provider payload shapes.
    return collectImages(hotel);
  }, [hotel, fallbackHotel]);

  const facilities = useMemo(
    () =>
      textList(
        hotel?.facilities || hotel?.amenities || hotel?.hotelFacilities,
        t,
      ),
    [hotel, t],
  );

  const name = hotel?.name || hotel?.hotelName || t("hotelDetail.hotelFallback");
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
  const description =
    localizedDescription ||
    cleanHotelDescription(
      hotel?.description || hotel?.hotelDescription,
      t("hotelDetail.descriptionFallback"),
    );

  const seo = <Seo title={`${name} | Rotavoy`} description={`${name}${address ? ` — ${address}` : ''}. ${travelSeoCopy('hotels', language).description}`} path={`/travel/hotels/${encodeURIComponent(hotelId)}`} image={images[0] || ''} noIndex={state === 'error'} jsonLd={state === 'success' && hotel ? { '@context': 'https://schema.org', '@type': 'Hotel', name, url: `${SITE_URL}/travel/hotels/${encodeURIComponent(hotelId)}`, ...(address ? { address } : {}), ...(images[0] ? { image: images[0] } : {}) } : null} />;

  async function handlePrebook(offer) {
    setBookingState("loading");
    setBookingError("");
    setPrebook(null);
    trackTravel('hotel_select', { hotelId, hotelName: hotel?.name, checkin, checkout, adults });
    setSelectedOffer(offer);

    try {
      const response = await prebookHotel(offer.offerId, { total: offer.suggestedSellingPrice.amount, currency: offer.suggestedSellingPrice.currency, conditions: offer.conditions });
      navigate("/travel/checkout", {
        state: { hotel, offer, prebook: response.data, checkin, checkout, adults },
      });
    } catch (bookingFailure) {
      setBookingState("error");
      setBookingError(
        /no availability|not available/i.test(bookingFailure.message)
          ? t("hotelDetail.roomSoldOut")
          : bookingFailure.message,
      );
    }
  }

  if (state === "loading") {
    return (
      <main className="hotelDetailState">
        {seo}
        <LoaderCircle className="travelSpin" size={30} />
        <p>{t("hotelDetail.loading")}</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="hotelDetailState hotelDetailState--error">
        {seo}
        <AlertCircle size={30} />
        <h1>{t("hotelDetail.loadErrorTitle")}</h1>
        <p>{error}</p>
        <Link to="/travel">{t("hotelDetail.backToSearch")}</Link>
      </main>
    );
  }

  return (
    <main className="hotelDetailPage">
      {seo}
      <div className="hotelDetailContainer">
        <Link className="hotelDetailBack" to="/travel">
          <ArrowLeft size={18} /> {t("hotelDetail.back")}
        </Link>

        <section className="hotelDetailHeader">
          <div>
            <div className="hotelDetailRatings">
              {stars > 0 && (
                <span className="hotelDetailStars">
                  <Star size={16} fill="currentColor" /> {stars} {t("hotelDetail.stars")}
                </span>
              )}
              {guestRating > 0 && (
                <span className="hotelDetailGuestRating">
                  {t("hotelDetail.guestRating")} {guestRating.toLocaleString(language === "pt" ? "pt-BR" : language)}/10
                </span>
              )}
            </div>
            <h1>{name}</h1>
            <HotelFavorite hotelId={hotelId} name={name} image={images[0]} />
            {address && (
              <p>
                <MapPin size={17} /> {address}
              </p>
            )}
          </div>
          {checkin && checkout && (
            <div className="hotelDetailStay">
              <strong>{checkin} → {checkout}</strong>
              <span><UsersRound size={15} /> {adults} {t(adults === 1 ? "hotelDetail.adult" : "hotelDetail.adults")}</span>
            </div>
          )}
        </section>

        <HotelStaySearch key={JSON.stringify([hotelId, checkin, checkout, adults])}
          checkin={checkin} checkout={checkout} adults={adults} t={t}
          disabled={bookingState === "loading"}
          onSearch={(start, end, guests) => {
            const params = new URLSearchParams(searchParams);
            params.set("checkin", start);
            params.set("checkout", end);
            params.set("adults", String(guests));
            setSelectedOffer(null);
            setPrebook(null);
            setBookingError("");
            setBookingState("idle");
            setSearchVersion((version) => version + 1);
            setSearchParams(params, { state: location.state });
          }} />

        <section className="hotelGallery">
          <div className="hotelGalleryMain">
            {images.length ? (
              <img
                src={images[activeImage]}
                alt={`${name} ${t("hotelDetail.photoAlt")} ${activeImage + 1}`}
              />
            ) : (
              <div className="hotelGalleryEmpty">
                <Hotel size={64} aria-hidden="true" />
                <span>{t("hotelDetail.noPhotos")}</span>
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
                  aria-label={t("hotelDetail.previousPhoto")}
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  className="hotelGalleryArrow hotelGalleryArrow--right"
                  onClick={() =>
                    setActiveImage((activeImage + 1) % images.length)
                  }
                  aria-label={t("hotelDetail.nextPhoto")}
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
                  aria-label={`${t("hotelDetail.photo")} ${index + 1}`}
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
              <h2>{t("hotelDetail.about")}</h2>
              <p className="hotelDescription">{description}</p>
            </section>

            <section className="hotelDetailCard">
              <h2>{t("hotelDetail.facilitiesTitle")}</h2>
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
                  {t("hotelDetail.noFacilities")}
                </p>
              )}
            </section>
          </div>

          <aside className="hotelDetailBooking">
            <div className="hotelDetailCard">
              <span className="hotelDetailEyebrow">{t("hotelDetail.availableRooms")}</span>
              <h2>{t("hotelDetail.chooseStay")}</h2>
              {nights > 0 && (
                <p className="hotelMuted">
                  <strong>
                    {nights} {t(nights === 1 ? "travelPage.runtime.nightSingular" : "travelPage.runtime.nightPlural")}
                    {" · "}{adults} {t(adults === 1 ? "hotelDetail.adult" : "hotelDetail.adults")}
                  </strong>
                </p>
              )}

              {!checkin || !checkout ? (
                <p className="hotelMuted">
                  {t("hotelDetail.selectDates")}
                </p>
              ) : ratesLoading ? (
                <p className="hotelMuted" role="status">
                  <LoaderCircle className="travelSpin" size={18} /> {t("travelPage.runtime.checking")}
                </p>
              ) : ratesError ? (
                <p className="hotelBookingMessage hotelBookingMessage--error">
                  <AlertCircle size={18} /> {ratesError}
                </p>
              ) : offers.length ? (
                <div className="hotelOffers">
                  {offers.map((offer) => {
                    return (
                    <article
                      key={offer.offerId}
                      className={`hotelOffer ${selectedOffer?.offerId === offer.offerId ? "hotelOffer--selected" : ""}`}
                    >
                      <div>
                        <BedDouble size={19} />
                        <strong>
                          {offer?.rates?.[0]?.name || t("hotelDetail.roomFallback")}
                        </strong>
                      </div>
                      <span>{totalStayLabel}</span>
                      <RateConditions conditions={offer.conditions} />
                      <b>
                        {money(
                          offer.suggestedSellingPrice.amount,
                          offer.suggestedSellingPrice.currency,
                          language,
                        )}
                      </b>
                      <button
                        type="button"
                        onClick={() => { trackTravel('room_select', { hotelId, hotelName: name, roomName: offer.roomName || offer.roomType || '', offerId: offer.offerId }); setSelectedOffer(offer); }}
                        aria-pressed={selectedOffer?.offerId === offer.offerId}
                      >
                        {selectedOffer?.offerId === offer.offerId ? t("rateConditions.selected") : t("rateConditions.select")}
                      </button>
                    </article>
                    );
                  })}
                  <button
                    type="button"
                    className="hotelBookSelected"
                    onClick={() => selectedOffer && handlePrebook(selectedOffer)}
                    disabled={!selectedOffer || bookingState === "loading"}
                  >
                    {bookingState === "loading" ? (
                      <><LoaderCircle className="travelSpin" size={17} /> {t("hotelDetail.preparing")}</>
                    ) : (
                      t("hotelDetail.book")
                    )}
                  </button>
                </div>
              ) : (
                <p className="hotelMuted">
                  {t("hotelDetail.noRooms")}
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
                    <strong>{t("hotelDetail.bookingReady")}</strong>
                    <span>
                      {money(
                        prebook.data.sellingPriceToUser,
                        prebook.data.currency,
                        language,
                      )}
                      {" · "}{totalStayLabel}
                    </span>
                    <Link
                      className="hotelCheckoutLink"
                      to="/travel/checkout"
                      state={{
                        hotel,
                        offer: selectedOffer,
                        prebook: prebook.data,
                        checkin,
                        checkout,
                        adults,
                      }}
                    >
                      Rezervasyon bilgilerine devam et
                    </Link>
                  </div>
                </div>
              )}

              <p className="hotelSecureNote">
                <ShieldCheck size={16} /> {t("hotelDetail.priceRecheck")}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default HotelDetails;
