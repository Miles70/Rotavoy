import TravelGuide from '../components/Seo/TravelGuide';
import { trackTravel } from '../services/analytics';
import Flights from "./Flights";
import CategoryPage from "./CategoryPage";
import RotavoyLogo from "../components/Brand/RotavoyLogo";
import { withHotelDistances } from "../services/hotelDistance.js";
import { getCurrentCoordinates } from "../services/geolocation.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BedDouble,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Hotel,
  LoaderCircle,
  MapPin,
  MapPinned,
  Plane,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { useLanguage } from "../i18n/LanguageContext";
import {
  listHotels,
  listIndexedShowcaseHotels,
  prebookHotel,
  searchHotelRates,
} from "../services/hotelsApi";
import "./Travel.css";
import "./TravelHeader.css";

const services = [
  { key: "hotels", icon: Hotel },
  { key: "flights", icon: Plane },
  { key: "cars", icon: CarFront },
  { key: "activities", icon: MapPinned },
];

const SHOWCASE_LIMIT = 21;
// Nuitee availability can vary from one request to the next. Scan a wider
// catalog window, then keep previously found live offers while new results
// replenish the showcase. This prevents the 5★ shelf from jumping from 20
// cards down to 11–14 during a background refresh.
const SHOWCASE_SCAN_BATCH = 100;
const SHOWCASE_MAX_BATCHES = 5;
const SHOWCASE_REFRESH_MS = 10 * 60 * 1000;
const DEFAULT_SHOWCASE_CITY = "Antalya";
const DEFAULT_SHOWCASE_FALLBACK_CITIES = ["Belek", "Side", "Kemer", "Alanya"];

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function money(amount, currency = "EUR") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function stayNights(checkin, checkout) {
  if (!checkin || !checkout) return 0;

  const start = new Date(`${checkin}T00:00:00.000Z`);
  const end = new Date(`${checkout}T00:00:00.000Z`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);

  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

function stayMetaText({ adults, checkin, checkout, t }) {
  const guestCount = Math.max(Number(adults) || 1, 1);
  const nights = stayNights(checkin, checkout);
  const guestLabel = t(
    guestCount === 1
      ? "travelPage.runtime.guestSingular"
      : "travelPage.runtime.guestPlural",
  );
  const nightLabel = t(
    nights === 1
      ? "travelPage.runtime.nightSingular"
      : "travelPage.runtime.nightPlural",
  );

  return {
    guests: `${guestCount} ${guestLabel}`,
    nights: `${nights} ${nightLabel}`,
  };
}

function stayPriceLabel({ adults, checkin, checkout, t }) {
  const stay = stayMetaText({ adults, checkin, checkout, t });
  return `${stay.nights} · ${stay.guests} · ${t("travelPage.runtime.totalSalePrice")}`;
}

function findVideoUrl(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return /^https?:\/\//i.test(value) && /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(value)
      ? value
      : "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoUrl(item);
      if (found) return found;
    }
    return "";
  }

  if (typeof value !== "object") return "";

  for (const [key, nested] of Object.entries(value)) {
    if (/video/i.test(key) && typeof nested === "string" && /^https?:\/\//i.test(nested)) {
      return nested;
    }
  }

  for (const nested of Object.values(value)) {
    const found = findVideoUrl(nested);
    if (found) return found;
  }

  return "";
}

function buildResults(rateResponse) {
  const hotelsById = new Map(
    (rateResponse?.hotels || []).map((hotel) => [hotel.id, hotel]),
  );

  return (rateResponse?.data || [])
    .map((hotelRate) => {
      const offers = (hotelRate.roomTypes || []).filter(
        (room) => room?.offerId && room?.suggestedSellingPrice?.amount,
      );
      const cheapest = offers.sort(
        (left, right) =>
          Number(left.suggestedSellingPrice.amount) -
          Number(right.suggestedSellingPrice.amount),
      )[0];

      if (!cheapest) return null;

      const hotelData = hotelsById.get(hotelRate.hotelId) || {};
      return {
        ...hotelData,
        hotelId: hotelRate.hotelId,
        offer: cheapest,
        offers,
        videoUrl: findVideoUrl(hotelData) || findVideoUrl(hotelRate),
      };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        Number(left.offer.suggestedSellingPrice.amount) -
        Number(right.offer.suggestedSellingPrice.amount),
    );
}

function isFiveStarHotel(hotel) {
  const stars = Number.parseFloat(String(hotel?.stars ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(stars) && stars >= 5;
}

function countryFlagImage(countryCode) {
  const code = String(countryCode || "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(code)
    ? `https://flagcdn.com/40x30/${code}.png`
    : "";
}

function countryName(countryCode, language) {
  const code = String(countryCode || "").trim().toUpperCase();
  if (!code) return "";

  try {
    return new Intl.DisplayNames([language || "en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function diversifyShowcaseHotels(hotels, limit) {
  const unique = [];
  const seen = new Set();

  for (const hotel of hotels) {
    if (!hotel?.hotelId || !hotel?.offer?.offerId || seen.has(hotel.hotelId)) continue;
    seen.add(hotel.hotelId);
    unique.push(hotel);
  }

  const output = [];
  const outputIds = new Set();

  const takeRoundRobin = (items) => {
    const groups = new Map();

    for (const hotel of items) {
      const country =
        hotel.showcaseCountryCode ||
        hotel.countryCode ||
        hotel.country_code ||
        "GLOBAL";

      if (!groups.has(country)) groups.set(country, []);
      groups.get(country).push(hotel);
    }

    while (groups.size && output.length < limit) {
      for (const [country, group] of [...groups.entries()]) {
        const hotel = group.shift();

        if (hotel && !outputIds.has(hotel.hotelId)) {
          outputIds.add(hotel.hotelId);
          output.push(hotel);
        }

        if (!group.length) groups.delete(country);
        if (output.length >= limit) break;
      }
    }
  };

  takeRoundRobin(unique.filter((hotel) => hotel.videoUrl));
  takeRoundRobin(unique.filter((hotel) => !hotel.videoUrl));

  return output.slice(0, limit);
}

function ShowcaseHotelMedia({ hotel, to, ariaLabel, starLabel, language }) {
  const videoRef = useRef(null);

  const playVideo = () => {
    if (!hotel.videoUrl || !videoRef.current) return;
    const playPromise = videoRef.current.play();
    if (playPromise?.catch) playPromise.catch(() => {});
  };

  const stopVideo = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  };

  return (
    <Link
      className={`travelHotelMedia${hotel.videoUrl ? " travelHotelMedia--video" : ""}`}
      to={to}
      state={{ hotel }}
      aria-label={ariaLabel}
      onMouseEnter={playVideo}
      onMouseLeave={stopVideo}
      onFocus={playVideo}
      onBlur={stopVideo}
    >
      {hotel.main_photo ? (
        <img src={hotel.main_photo} alt="" loading="lazy" />
      ) : (
        <Hotel size={42} aria-hidden="true" />
      )}

      {hotel.videoUrl ? (
        <>
          <video
            ref={videoRef}
            src={hotel.videoUrl}
            poster={hotel.main_photo || undefined}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
        </>
      ) : null}

      <span className="travelHotelMediaOverlay" aria-hidden="true">
        {hotel.videoUrl ? <span className="travelVideoBadge">VIDEO</span> : null}

        <span className="travelCountryBadge">
          {countryFlagImage(hotel.showcaseCountryCode) ? (
            <img
              className="travelCountryFlag"
              src={countryFlagImage(hotel.showcaseCountryCode)}
              alt=""
              loading="lazy"
            />
          ) : null}
          <span className="travelCountryName">
            {countryName(hotel.showcaseCountryCode, language)}
          </span>
        </span>

        <span className="travelStarsBadge">{starLabel}</span>
      </span>
    </Link>
  );
}

function Travel({ hotelsOnly = false }) {
  const [homeSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const autoSearchStarted = useRef(false);
  const travelVideoRef = useRef(null);
  const showcaseRefreshingRef = useRef(false);
  const [activeService, setActiveService] = useState("hotels");
  const [cityName, setCityName] = useState(
    () => homeSearchParams.get("cityName") || "Antalya",
  );
  const [checkin, setCheckin] = useState(
    () => homeSearchParams.get("checkin") || addDays(30),
  );
  const [checkout, setCheckout] = useState(
    () => homeSearchParams.get("checkout") || addDays(32),
  );
  const [adults, setAdults] = useState(() =>
    Math.min(Math.max(Number(homeSearchParams.get("adults")) || 2, 1), 5),
  );
  const [results, setResults] = useState([]);
  const [showcaseHotels, setShowcaseHotels] = useState([]);
  const [showcaseState, setShowcaseState] = useState("idle");
  const [showcaseError, setShowcaseError] = useState("");
  const [catalogOffset, setCatalogOffset] = useState(0);
  const [hasMoreHotels, setHasMoreHotels] = useState(false);
  const [loadMoreState, setLoadMoreState] = useState("idle");
  const [loadMoreError, setLoadMoreError] = useState("");
  const completedSearch = useRef(null);
  const [nearbyCoordinates, setNearbyCoordinates] = useState(null);
  const [nearbyRadius, setNearbyRadius] = useState(10000);
  const [locating, setLocating] = useState(false);
  const [searchState, setSearchState] = useState("idle");
  const [searchError, setSearchError] = useState("");
  const [prebookState, setPrebookState] = useState("idle");
  const [prebookError, setPrebookError] = useState("");
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [prebook, setPrebook] = useState(null);
  const { t, language } = useLanguage();
  const activeServiceKey = "travelPage.services.hotels";

  function customerHotelError(error, fallbackKey = "travelPage.runtime.noAvailability") {
    const message = String(error?.message || "");
    if (/no availability|not available/i.test(message)) {
      return t("travelPage.runtime.noAvailability");
    }
    if (/timed out|timeout/i.test(message)) {
      return t("travelPage.runtime.serviceTimeout");
    }
    if (/could not be reached|fetch failed|network/i.test(message)) {
      return t("travelPage.runtime.serviceUnavailable");
    }
    return message || t(fallbackKey);
  }

  const minimumCheckout = useMemo(() => {
    if (!checkin) return addDays(1);
    const date = new Date(`${checkin}T00:00:00.000Z`);
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }, [checkin]);

  useEffect(() => {
    const video = travelVideoRef.current;
    if (!video) return undefined;

    const startPlayback = () => {
      const playback = video.play();
      if (playback?.catch) playback.catch(() => {});
    };

    startPlayback();
    document.addEventListener("visibilitychange", startPlayback);
    return () => document.removeEventListener("visibilitychange", startPlayback);
  }, []);

  useEffect(() => {
    if (
      homeSearchParams.get("auto") !== "1" ||
      autoSearchStarted.current
    ) {
      return;
    }

    autoSearchStarted.current = true;
    runSearch();
  }, []);

  useEffect(() => {
    loadFiveStarShowcase();

    const refreshShowcase = () => {
      if (document.visibilityState === "visible") {
        loadFiveStarShowcase({ silent: true });
      }
    };

    const refreshTimer = window.setInterval(
      refreshShowcase,
      SHOWCASE_REFRESH_MS,
    );

    document.addEventListener("visibilitychange", refreshShowcase);

    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshShowcase);
    };
  }, [checkin, checkout, adults]);

  async function loadFiveStarShowcase({ silent = false } = {}) {
    if (showcaseRefreshingRef.current) return;

    showcaseRefreshingRef.current = true;
    const requestedCity = DEFAULT_SHOWCASE_CITY;
    const showcaseCities = [
      DEFAULT_SHOWCASE_CITY,
      ...DEFAULT_SHOWCASE_FALLBACK_CITIES,
    ];

    if (!silent) {
      setShowcaseState("loading");
      setShowcaseHotels([]);
    }

    setShowcaseError("");

    try {
      const collected = [];
      const knownIds = new Set();

      const publishCollectedHotels = ({ final = false } = {}) => {
        if (silent && !final) return;

        setShowcaseHotels(
          diversifyShowcaseHotels(
            collected,
            SHOWCASE_LIMIT,
          ),
        );
      };

      try {
        const indexedResponse = await listIndexedShowcaseHotels(60);
        for (const hotelId of indexedResponse?.excludedHotelIds || []) knownIds.add(hotelId);
        const indexedHotels = Array.isArray(indexedResponse?.hotels)
          ? indexedResponse.hotels
          : [];
        const indexedById = new Map(
          indexedHotels
            .filter((hotel) => hotel?.hotelId)
            .map((hotel) => [hotel.hotelId, hotel]),
        );
        const indexedHotelIds = [...indexedById.keys()];

        if (indexedHotelIds.length) {
          const indexedRates = await searchHotelRates({
            hotelIds: indexedHotelIds,
            checkin,
            checkout,
            adults,
          });

          for (const hotel of buildResults(indexedRates)) {
            const indexedHotel = indexedById.get(hotel.hotelId);

            if (
              !indexedHotel ||
              !isFiveStarHotel(hotel) ||
              knownIds.has(hotel.hotelId)
            ) {
              continue;
            }

            knownIds.add(hotel.hotelId);
            collected.push({
              ...hotel,
              main_photo:
                hotel.hotelId === "lp22e91"
                  ? "https://static.cupid.travel/hotels/527859140.jpg"
                  : (indexedHotel.mainPhoto || hotel.main_photo || ""),
              videoUrl: indexedHotel.videoUrl || hotel.videoUrl || "",
              showcaseCheckin: checkin,
              showcaseCheckout: checkout,
              showcaseAdults: adults,
              showcaseCity:
                indexedHotel.cityName ||
                hotel.city_name ||
                "Global",
              showcaseCountryCode:
                indexedHotel.countryCode ||
                hotel.countryCode ||
                hotel.country_code ||
                "",
            });
          }

          publishCollectedHotels();
        }
      } catch {
        // The global index is optional. The fallback below keeps the page usable.
      }

      for (const showcaseCity of showcaseCities) {
        if (collected.length >= SHOWCASE_LIMIT) break;

        let offset = 0;
        let total = Number.POSITIVE_INFINITY;

        const maxBatchesForCity =
          showcaseCity === requestedCity ? SHOWCASE_MAX_BATCHES : 1;

        for (
          let batch = 0;
          batch < maxBatchesForCity &&
          collected.length < SHOWCASE_LIMIT &&
          offset < total;
          batch += 1
        ) {
          const catalog = await listHotels({
            countryCode: "TR",
            cityName: showcaseCity,
            limit: SHOWCASE_SCAN_BATCH,
            offset,
          });

          const hotelIds = (catalog?.hotelIds || []).slice(0, SHOWCASE_SCAN_BATCH);
          total = Number(catalog?.total || offset + hotelIds.length);

          if (!hotelIds.length) break;

          const rateResponse = await searchHotelRates({
            hotelIds,
            checkin,
            checkout,
            adults,
          });

          for (const hotel of buildResults(rateResponse)) {
            if (!isFiveStarHotel(hotel) || knownIds.has(hotel.hotelId)) continue;

            knownIds.add(hotel.hotelId);
            collected.push({
              ...hotel,
              showcaseCheckin: checkin,
              showcaseCheckout: checkout,
              showcaseAdults: adults,
              showcaseCity,
              showcaseCountryCode: "TR",
            });

            if (collected.length >= SHOWCASE_LIMIT) break;
          }

          // Video metadata is taken only from the existing rates payload.
          // No per-hotel detail requests are fired from the showcase.
          publishCollectedHotels();
          offset += hotelIds.length;
        }
      }

      publishCollectedHotels({ final: true });
      setShowcaseState("success");
    } catch (error) {
      if (!silent) {
        setShowcaseState("error");
        setShowcaseError(
          customerHotelError(error, "travelPage.runtime.serviceUnavailable"),
        );
      }
    } finally {
      showcaseRefreshingRef.current = false;
    }
  }

  async function runSearch(locationOverride) {
    const location = locationOverride || (nearbyCoordinates
      ? { ...nearbyCoordinates, radius: nearbyRadius }
      : { destination: cityName.trim() });

    if (activeService !== "hotels") {
      setSearchError(t("travelPage.runtime.comingSoon"));
      return;
    }

    if ((location.latitude === undefined && !location.destination) || !checkin || !checkout || checkout <= checkin) {
      setSearchError(t("travelPage.runtime.invalidSearch"));
      return;
    }

    trackTravel('hotel_search', { destination: location.destination || 'Konum yakını', checkin, checkout, adults });
    completedSearch.current = null;
    setLoadMoreState("idle");
    setSearchState("loading");
    setSearchError("");
    setResults([]);
    setCatalogOffset(0);
    setHasMoreHotels(false);
    setLoadMoreError("");
    setPrebook(null);
    setSelectedHotel(null);

    try {
      const catalog = await listHotels({
        ...location,
        limit: 20,
        offset: 0,
      });
      const hotelIds = (catalog?.hotelIds || []).slice(0, 20);

      if (!hotelIds.length) {
        throw new Error(t(location.latitude !== undefined ? "travelPage.nearby.empty" : "travelPage.runtime.cityNotFound"));
      }

      const rateResponse = await searchHotelRates({
        hotelIds,
        checkin,
        checkout,
        adults,
      });
      const availableHotels = withHotelDistances(buildResults(rateResponse), catalog, location);

      if (!availableHotels.length) {
        throw new Error(t("travelPage.runtime.noAvailability"));
      }

      completedSearch.current = { ...catalog.location, checkin, checkout, adults };
      setResults(availableHotels);
      setCatalogOffset(hotelIds.length);
      setHasMoreHotels(hotelIds.length < Number(catalog?.total || 0));
      setSearchState("success");
    } catch (error) {
      setSearchState("error");
      setSearchError(customerHotelError(error));
    }
  }

  async function handleNearbySearch() {
    if (searchState === "loading" || locating) return;
    if (!checkin || !checkout || checkout <= checkin) {
      setSearchError(t("travelPage.runtime.invalidSearch"));
      return;
    }
    if (!window.isSecureContext) {
      setSearchError(t("travelPage.nearby.insecure"));
      return;
    }
    if (!navigator.geolocation) {
      setSearchError(t("travelPage.nearby.unsupported"));
      return;
    }
    setLocating(true);
    setSearchError("");
    try {
      const coordinates = await getCurrentCoordinates();
      setNearbyCoordinates(coordinates);
      await runSearch({ ...coordinates, radius: nearbyRadius });
    } catch (error) {
      const key = error.code === 1 ? "denied" : error.code === 3 ? "timeout" : "unavailable";
      setSearchError(t(`travelPage.nearby.${key}`));
    } finally {
      setLocating(false);
    }
  }

  function handleSearch(event) {
    event.preventDefault();
    if (!hotelsOnly && !nearbyCoordinates) {
      if (!cityName.trim() || !checkin || !checkout || checkout <= checkin) { runSearch(); return; }
      navigate(`/hotels?${new URLSearchParams({ cityName: cityName.trim(), checkin, checkout, adults: String(adults), auto: "1" })}`);
      return;
    }
    runSearch();
  }

  function hotelDetailsUrl(hotel) {
    const query = new URLSearchParams({
      checkin: hotel.showcaseCheckin || checkin,
      checkout: hotel.showcaseCheckout || checkout,
      adults: String(hotel.showcaseAdults || adults),
    });
    return `/travel/hotels/${encodeURIComponent(hotel.hotelId)}?${query.toString()}`;
  }

  async function handleLoadMore() {
    if (loadMoreState === "loading" || !hasMoreHotels) return;

    const selection = completedSearch.current;
    if (!selection) return;
    setLoadMoreState("loading");
    setLoadMoreError("");

    try {
      const catalog = await listHotels({
        ...selection,
        limit: 20,
        offset: catalogOffset,
      });
      const hotelIds = (catalog?.hotelIds || []).slice(0, 20);
      const nextOffset = catalogOffset + hotelIds.length;
      if (completedSearch.current !== selection) return;

      if (!hotelIds.length) {
        setHasMoreHotels(false);
        setLoadMoreState("success");
        return;
      }

      const rateResponse = await searchHotelRates({
        hotelIds,
        checkin: selection.checkin,
        checkout: selection.checkout,
        adults: selection.adults,
      });
      if (completedSearch.current !== selection) return;
      const nextHotels = withHotelDistances(buildResults(rateResponse), catalog, selection);

      setResults((current) => {
        const knownIds = new Set(current.map((hotel) => hotel.hotelId));
        return [
          ...current,
          ...nextHotels.filter((hotel) => !knownIds.has(hotel.hotelId)),
        ];
      });
      setCatalogOffset(nextOffset);
      setHasMoreHotels(nextOffset < Number(catalog?.total || 0));
      setLoadMoreState("success");
    } catch (error) {
      if (completedSearch.current !== selection) return;
      setLoadMoreState("error");
      setLoadMoreError(customerHotelError(error, "travelPage.runtime.loadMoreFailed"));
    }
  }

  async function handlePrebook(hotel) {
    trackTravel('hotel_select', { hotelId: hotel.hotelId, hotelName: hotel.name, checkin, checkout, adults });
    setSelectedHotel(hotel);
    setPrebook(null);
    setPrebookError("");
    setPrebookState("loading");

    const offers = hotel.offers?.length ? hotel.offers : [hotel.offer];
    let lastAvailabilityError = null;

    for (const offer of offers) {
      try {
        const response = await prebookHotel(offer.offerId, { total: offer.suggestedSellingPrice.amount, currency: offer.suggestedSellingPrice.currency, conditions: offer.conditions });
        navigate("/travel/checkout", {
          state: {
            hotel: { ...hotel, offer },
            offer,
            prebook: response.data,
            checkin,
            checkout,
            adults,
          },
        });
        return;
      } catch (error) {
        const isAvailabilityError = /no availability|not available/i.test(
          error.message,
        );

        if (!isAvailabilityError) {
          setPrebookState("error");
          setPrebookError(error.message);
          return;
        }

        lastAvailabilityError = error;
      }
    }

    setPrebookState("error");
    setPrebookError(
      lastAvailabilityError
        ? t("travelPage.runtime.soldOut")
        : t("travelPage.runtime.offerUnavailable"),
    );
  }

  return (
    <main className="travelPage">
      <section className="travelHero">
        <video
          ref={travelVideoRef}
          className="travelHeroVideo"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={(event) => event.currentTarget.play().catch(() => {})}
          poster="/images/rotavoy-travel-beach-poster.webp"
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src="/images/rotavoy-travel-beach.mp4" type="video/mp4" />
        </video>

        <div className="travelHeroGlow travelHeroGlow--one" />
        <div className="travelHeroGlow travelHeroGlow--two" />

        <div className="travelContainer travelHeroContent">
          <div className="travelIntro">
            <div className="travelBrandBlock">
              <div>
                <RotavoyLogo className="heroRotavoyLogo" />
                <small>{t("travelPage.onlineTravelAgency")}</small>
              </div>
            </div>

            <span className="travelPill">
              <Sparkles size={15} />
              {t("travelPage.pill")}
            </span>

            <h1>
              {hotelsOnly ? t("travelPage.services.hotels.title") : <>{t("travelPage.heroTitle")} <span>{t("travelPage.heroAccent")}</span></>}
            </h1>

            <p>{t("travelPage.heroText")}</p>

            <div className="travelTrustRow">
              <span>
                <ShieldCheck size={17} /> {t("travelPage.trustSecure")}
              </span>
              <span>
                <WalletCards size={17} /> {t("travelPage.trustPayment")}
              </span>
            </div>
          </div>

          <div className="travelSearchShell">
            {!hotelsOnly && <div
              className="travelServiceTabs"
              role="tablist"
              aria-label={t("travelPage.servicesLabel")}
            >
              {services.map(({ key, icon: Icon }) => (
                <button
                  type="button"
                  key={key}
                  role="tab"
                  id={`service-tab-${key}`}
                  aria-controls={`service-panel-${key}`}
                  tabIndex={activeService === key ? 0 : -1}
                  onKeyDown={(event) => {
                    const index = services.findIndex((service) => service.key === key);
                    const next = event.key === "ArrowRight" ? (index + 1) % services.length : event.key === "ArrowLeft" ? (index + services.length - 1) % services.length : event.key === "Home" ? 0 : event.key === "End" ? services.length - 1 : null;
                    if (next === null) return;
                    event.preventDefault(); trackTravel('category_select', { category: services[next].key }); setActiveService(services[next].key);
                    document.getElementById(`service-tab-${services[next].key}`)?.focus();
                  }}
                  aria-selected={activeService === key}
                  className={activeService === key ? "active" : ""}
                  onClick={() => {
                    trackTravel('category_select', { category: key });
                    setActiveService(key);
                    setSearchError("");
                  }}
                >
                  <Icon size={18} />
                  <span>{t(`travelPage.services.${key}.label`)}</span>
                </button>
              ))}
            </div>}

            <div role={hotelsOnly ? undefined : "tabpanel"} id="service-panel-hotels" aria-labelledby={hotelsOnly ? undefined : "service-tab-hotels"} hidden={activeService !== "hotels"}>
            <form className="travelSearchCard" onSubmit={handleSearch}>
              <div className="travelSearchHeading">
                <span>{t(`${activeServiceKey}.eyebrow`)}</span>
                <h2>{t(`${activeServiceKey}.title`)}</h2>
              </div>

              {activeService === "hotels" && (
                <div className="travelNearbyControls">
                  <button type="button" className="travelNearbyButton" onClick={handleNearbySearch}
                    disabled={searchState === "loading" || locating}>
                    {locating ? <LoaderCircle className="travelSpin" size={18} /> : <MapPinned size={18} />}
                    {t(locating ? "travelPage.nearby.locating" : "travelPage.nearby.button")}
                  </button>
                  <label>
                    <span>{t("travelPage.nearby.radius")}</span>
                    <select value={nearbyRadius} disabled={searchState === "loading" || locating}
                      onChange={(event) => setNearbyRadius(Number(event.target.value))}>
                      {[5000, 10000, 25000, 50000].map((radius) => (
                        <option key={radius} value={radius}>{radius / 1000} km</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <div className="travelSearchGrid">
                <label className="travelField travelField--wide">
                  <span>{t(`${activeServiceKey}.locationLabel`)}</span>
                  <div>
                    <MapPin size={18} />
                    <input
                      type="text"
                      value={nearbyCoordinates ? t("travelPage.nearby.title") : cityName}
                      onChange={(event) => { setNearbyCoordinates(null); setCityName(event.target.value); }}
                      placeholder={t(`${activeServiceKey}.locationPlaceholder`)}
                      disabled={searchState === "loading" || locating}
                    />
                  </div>
                </label>

                <label className="travelField">
                  <span>{t("travelPage.search.start")}</span>
                  <div>
                    <CalendarDays size={18} />
                    <input
                      type="date"
                      value={checkin}
                      min={addDays(1)}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCheckin(value);
                        if (checkout <= value) setCheckout("");
                      }}
                      disabled={searchState === "loading" || locating}
                    />
                  </div>
                </label>

                <label className="travelField">
                  <span>{t("travelPage.search.end")}</span>
                  <div>
                    <CalendarDays size={18} />
                    <input
                      type="date"
                      value={checkout}
                      min={minimumCheckout}
                      onChange={(event) => setCheckout(event.target.value)}
                      disabled={searchState === "loading" || locating}
                    />
                  </div>
                </label>

                <label className="travelField">
                  <span>{t("travelPage.search.guests")}</span>
                  <div>
                    <UsersRound size={18} />
                    <select
                      value={adults}
                      onChange={(event) => setAdults(Number(event.target.value))}
                      disabled={searchState === "loading" || locating}
                    >
                      <option value="1">{t("travelPage.search.people1")}</option>
                      <option value="2">{t("travelPage.search.people2")}</option>
                      <option value="3">{t("travelPage.search.people3")}</option>
                      <option value="4">{t("travelPage.search.people4")}</option>
                      <option value="5">{t("travelPage.search.people5")}</option>
                    </select>
                  </div>
                </label>

                <button
                  className="travelSearchButton"
                  type="submit"
                  disabled={searchState === "loading" || locating}
                >
                  {searchState === "loading" ? (
                    <LoaderCircle className="travelSpin" size={19} />
                  ) : (
                    <Search size={19} />
                  )}
                  {searchState === "loading"
                    ? t("travelPage.runtime.searching")
                    : t(`${activeServiceKey}.button`)}
                </button>
              </div>

              {searchError && (
                <p className="travelSearchMessage travelSearchMessage--error">
                  <AlertCircle size={16} />
                  {searchError}
                </p>
              )}

              <p className="travelPrototypeNote">
                {t("travelPage.runtime.liveNote")}
              </p>
            </form>
            </div>
            {!hotelsOnly && <>
              <div role="tabpanel" id="service-panel-flights" aria-labelledby="service-tab-flights" hidden={activeService !== "flights"}><Flights embedded /></div>
              { ["cars", "activities"].map((category) => <div key={category} role="tabpanel" id={`service-panel-${category}`} aria-labelledby={`service-tab-${category}`} hidden={activeService !== category}><CategoryPage category={category} embedded /></div>) }
            </>}
          </div>
        </div>
      </section>

      {results.length > 0 && (
        <section className="travelHotelResults" aria-live="polite">
          <div className="travelContainer">
            <div className="travelResultsHeading">
              <div>
                <span>{t("travelPage.runtime.liveAvailability")}</span>
                <h2>{completedSearch.current?.latitude !== undefined ? `${t("travelPage.nearby.title")} · ${completedSearch.current.radius / 1000} km` : `${cityName} ${t("travelPage.runtime.hotels")}`}</h2>
              </div>
              <p>{results.length} {t("travelPage.runtime.resultsSuffix")}</p>
            </div>

            <div className="travelHotelGrid">
              {results.map((hotel) => (
                <article className="travelHotelCard" key={hotel.hotelId}>
                  <Link
                    className="travelHotelMedia"
                    to={hotelDetailsUrl(hotel)}
                    state={{ hotel }}
                    aria-label={`${hotel.name || t("travelPage.runtime.hotelFallback")} ${t("travelPage.runtime.detailsAria")}`}
                  >
                    {hotel.main_photo ? (
                      <img src={hotel.main_photo} alt="" loading="lazy" />
                    ) : (
                      <Hotel size={42} aria-hidden="true" />
                    )}
                    {hotel.stars ? <span>{hotel.stars} {t("travelPage.runtime.stars")}</span> : null}
                  </Link>

                  <div className="travelHotelBody">
                    <div className="travelHotelRating">
                      <Star size={15} fill="currentColor" />
                      <strong>{hotel.rating || t("travelPage.runtime.newRating")}</strong>
                      {hotel.review_count ? <span>{hotel.review_count} {t("travelPage.runtime.reviews")}</span> : null}
                    </div>
                    <h3>
                      <Link to={hotelDetailsUrl(hotel)} state={{ hotel }}>
                        {hotel.name || t("travelPage.runtime.hotelFallback")}
                      </Link>
                    </h3>
                    <p>
                      <MapPin size={15} />
                      {hotel.address || hotel.city_name || cityName}
                    </p>
                    {Number.isFinite(hotel.distanceKm) && (
                      <div className="travelHotelDistance">
                        <MapPinned size={16} aria-hidden="true" />
                        <span>{t("travelPage.nearby.distance")} <strong>{new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(hotel.distanceKm)} km</strong>
                          <small>{t("travelPage.nearby.straightLine")}</small>
                        </span>
                      </div>
                    )}
                    <div className="travelRoomLine">
                      <BedDouble size={17} />
                      <span>{hotel.offer?.rates?.[0]?.name || t("travelPage.runtime.roomFallback")}</span>
                    </div>
                    <div className="travelStayMeta">
                      <span>
                        <UsersRound size={15} />
                        {stayMetaText({ adults, checkin, checkout, t }).guests}
                      </span>
                      <span>
                        <CalendarDays size={15} />
                        {stayMetaText({ adults, checkin, checkout, t }).nights}
                      </span>
                    </div>
                    <div className="travelHotelPrice">
                      <span>{stayPriceLabel({ adults, checkin, checkout, t })}</span>
                      <strong>
                        {money(
                          hotel.offer.suggestedSellingPrice.amount,
                          hotel.offer.suggestedSellingPrice.currency,
                        )}
                      </strong>
                    </div>
                    <Link
                      className="travelHotelDetailsLink"
                      to={hotelDetailsUrl(hotel)}
                      state={{ hotel }}
                    >
                      {t("travelPage.runtime.viewDetails")} <ArrowRight size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handlePrebook(hotel)}
                      disabled={
                        selectedHotel?.hotelId === hotel.hotelId &&
                        prebookState === "loading"
                      }
                    >
                      {selectedHotel?.hotelId === hotel.hotelId &&
                      prebookState === "loading" ? (
                        <>
                          <LoaderCircle className="travelSpin" size={17} />
                          {t("travelPage.runtime.preparingBooking")}
                        </>
                      ) : (
                        <>
                          {t("travelPage.runtime.book")} <ArrowRight size={17} />
                        </>
                      )}
                    </button>

                    {selectedHotel?.hotelId === hotel.hotelId && (
                      <div className="travelCardPrebook" aria-live="polite">
                        {prebookState === "loading" && (
                          <p className="travelPrebookStatus">
                            <LoaderCircle className="travelSpin" size={18} />
                            {t("travelPage.runtime.checking")}
                          </p>
                        )}

                        {prebookState === "error" && (
                          <p className="travelPrebookStatus travelPrebookStatus--error">
                            <AlertCircle size={18} />
                            {prebookError}
                          </p>
                        )}

                        {prebookState === "success" && prebook?.data && (
                          <div className="travelPrebookSuccess">
                            <CheckCircle2 size={22} />
                            <div>
                              <strong>{t("travelPage.runtime.bookingReady")}</strong>
                              <span>
                                {money(
                                  prebook.data.sellingPriceToUser,
                                  prebook.data.currency,
                                )}
                                {" · "}
                                {stayPriceLabel({ adults, checkin, checkout, t })}
                              </span>
                            </div>
                            <Link
                              to="/travel/checkout"
                              state={{
                                hotel: selectedHotel,
                                offer: selectedHotel.offer,
                                prebook: prebook.data,
                                checkin,
                                checkout,
                                adults,
                              }}
                              title={t("travelPage.runtime.continueTitle")}
                            >
                              {t("travelPage.runtime.continueBooking")}
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {loadMoreError && (
              <p className="travelSearchMessage travelSearchMessage--error travelLoadMoreError">
                <AlertCircle size={16} />
                {loadMoreError}
              </p>
            )}

            {hasMoreHotels && (
              <button
                className="travelLoadMoreButton"
                type="button"
                onClick={handleLoadMore}
                disabled={loadMoreState === "loading"}
              >
                {loadMoreState === "loading" ? (
                  <>
                    <LoaderCircle className="travelSpin" size={18} />
                    {t("travelPage.runtime.loadingMore")}
                  </>
                ) : (
                  <>
                    {t("travelPage.runtime.loadMore")} <ArrowRight size={17} />
                  </>
                )}
              </button>
            )}

          </div>
        </section>
      )}

      <section className="travelRoutesSection" aria-live="polite">
        <div className="travelContainer">
          <div className="travelSectionHeading">
            <div>
              <span>{t("travelPage.runtime.liveAvailability")} · 5★</span>
              <h2>5★ {t("travelPage.runtime.hotels")}</h2>
            </div>
            <p>
              {showcaseState === "loading"
                ? t("travelPage.runtime.searching")
                : `${showcaseHotels.length} ${t("travelPage.runtime.resultsSuffix")}`}
            </p>
          </div>

          {showcaseState === "loading" && (
            <div className="travelShowcaseStatus">
              <LoaderCircle className="travelSpin" size={24} />
              <span>{t("travelPage.runtime.searching")}</span>
            </div>
          )}

          {showcaseState === "error" && (
            <p className="travelSearchMessage travelSearchMessage--error travelShowcaseMessage">
              <AlertCircle size={16} />
              {showcaseError}
            </p>
          )}

          {showcaseState === "success" && showcaseHotels.length === 0 && (
            <div className="travelShowcaseStatus">
              <Hotel size={28} />
              <span>{t("travelPage.runtime.noAvailability")}</span>
            </div>
          )}

          {showcaseHotels.length > 0 && (
            <div className="travelHotelGrid travelShowcaseGrid">
              {showcaseHotels.map((hotel) => (
                <article className="travelHotelCard" key={hotel.hotelId}>
                  <ShowcaseHotelMedia
                    hotel={hotel}
                    to={hotelDetailsUrl(hotel)}
                    ariaLabel={`${hotel.name || t("travelPage.runtime.hotelFallback")} ${t("travelPage.runtime.detailsAria")}`}
                    starLabel={`5 ${t("travelPage.runtime.stars")}`}
                    language={language}
                  />

                  <div className="travelHotelBody">
                    <div className="travelHotelRating">
                      <Star size={15} fill="currentColor" />
                      <strong>{hotel.rating || "5.0"}</strong>
                      {hotel.review_count ? (
                        <span>{hotel.review_count} {t("travelPage.runtime.reviews")}</span>
                      ) : null}
                    </div>

                    <h3>
                      <Link to={hotelDetailsUrl(hotel)} state={{ hotel }}>
                        {hotel.name || t("travelPage.runtime.hotelFallback")}
                      </Link>
                    </h3>

                    <p>
                      <MapPin size={15} />
                      {hotel.address || hotel.city_name || hotel.showcaseCity}
                    </p>

                    <div className="travelRoomLine">
                      <BedDouble size={17} />
                      <span>
                        {hotel.offer?.rates?.[0]?.name ||
                          t("travelPage.runtime.roomFallback")}
                      </span>
                    </div>

                    <div className="travelStayMeta">
                      <span>
                        <UsersRound size={15} />
                        {stayMetaText({
                          adults: hotel.showcaseAdults,
                          checkin: hotel.showcaseCheckin,
                          checkout: hotel.showcaseCheckout,
                          t,
                        }).guests}
                      </span>
                      <span>
                        <CalendarDays size={15} />
                        {stayMetaText({
                          adults: hotel.showcaseAdults,
                          checkin: hotel.showcaseCheckin,
                          checkout: hotel.showcaseCheckout,
                          t,
                        }).nights}
                      </span>
                    </div>

                    <div className="travelHotelPrice">
                      <span>{stayPriceLabel({
                        adults: hotel.showcaseAdults,
                        checkin: hotel.showcaseCheckin,
                        checkout: hotel.showcaseCheckout,
                        t,
                      })}</span>
                      <strong>
                        {money(
                          hotel.offer.suggestedSellingPrice.amount,
                          hotel.offer.suggestedSellingPrice.currency,
                        )}
                      </strong>
                    </div>

                    <Link
                      className="travelHotelDetailsLink"
                      to={hotelDetailsUrl(hotel)}
                      state={{ hotel }}
                    >
                      {t("travelPage.runtime.viewDetails")} <ArrowRight size={16} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      {hotelsOnly && <TravelGuide category="hotels" language={language} />}
    </main>
  );
}

export default Travel;
