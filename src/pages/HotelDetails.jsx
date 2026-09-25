import { useEffect, useMemo, useState } from "react";
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
      const key = facilityKeys.get(item.toLowerCase());
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

function HotelDetails() {
  const { hotelId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkin = searchParams.get("checkin") || "";
  const checkout = searchParams.get("checkout") || "";
  const adults = Math.min(
    Math.max(Number(searchParams.get("adults")) || 2, 1),
    10,
  );
  const fallbackHotel = location.state?.hotel || null;
  const { t, language } = useLanguage();

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
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [localizedDescription, setLocalizedDescription] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!fallbackHotel) setState("loading");
      setError("");
      setRatesError("");

      const detailsPromise = getHotelDetails(hotelId);
      const hasSearchOffers = Boolean(
        fallbackHotel?.offers?.length || fallbackHotel?.offer,
      );
      const ratesPromise =
        checkin && checkout && !hasSearchOffers
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
            ? detailsResult.reason?.message || t("hotelDetail.detailsUnavailable")
            : t("hotelDetail.hotelNotFound"),
        );
      }

      if (ratesResult.status === "fulfilled" && ratePayload) {
        setOffers(buildOffers(ratePayload));
      } else if (ratesResult.status === "rejected") {
        const upstreamMessage = String(ratesResult.reason?.message || "");
        setRatesError(
          /no availability|not available/i.test(upstreamMessage)
            ? t("hotelDetail.noRooms")
            : t("hotelDetail.ratesUnavailable"),
        );
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [hotelId, checkin, checkout, adults, fallbackHotel, t]);

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
    const collected = collectImages(hotel);

    // Prefer the hotel's real gallery. Provider main_photo is often a smaller
    // duplicate of one of those images, so only use it when no gallery exists.
    if (
      collected.length === 0 &&
      fallbackHotel?.main_photo &&
      !collected.includes(fallbackHotel.main_photo)
    ) {
      collected.push(fallbackHotel.main_photo);
    }

    return collected;
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

  async function handlePrebook(offer) {
    setBookingState("loading");
    setBookingError("");
    setPrebook(null);
    setSelectedOffer(offer);

    try {
      const response = await prebookHotel(offer.offerId);
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
        <LoaderCircle className="travelSpin" size={30} />
        <p>{t("hotelDetail.loading")}</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="hotelDetailState hotelDetailState--error">
        <AlertCircle size={30} />
        <h1>{t("hotelDetail.loadErrorTitle")}</h1>
        <p>{error}</p>
        <Link to="/travel">{t("hotelDetail.backToSearch")}</Link>
      </main>
    );
  }

  return (
    <main className="hotelDetailPage">
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

              {!checkin || !checkout ? (
                <p className="hotelMuted">
                  {t("hotelDetail.selectDates")}
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
                          {offer?.rates?.[0]?.name || t("hotelDetail.roomFallback")}
                        </strong>
                      </div>
                      <span>{t("hotelDetail.totalPrice")}</span>
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
                            {t("hotelDetail.preparing")}
                          </>
                        ) : (
                          t("hotelDetail.book")
                        )}
                      </button>
                    </article>
                  ))}
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
                      )}
                      {" · "}{t("hotelDetail.totalPrice")}
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
