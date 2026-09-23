import { useMemo, useState } from "react";
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

const routeCards = [
  { key: "antalya", icon: Hotel },
  { key: "istanbul", icon: Plane },
  { key: "freedom", icon: CarFront },
];

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

      return {
        ...hotelsById.get(hotelRate.hotelId),
        hotelId: hotelRate.hotelId,
        offer: cheapest,
      };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        Number(left.offer.suggestedSellingPrice.amount) -
        Number(right.offer.suggestedSellingPrice.amount),
    );
}

function Travel() {
  const [activeService, setActiveService] = useState("hotels");
  const [cityName, setCityName] = useState("Antalya");
  const [checkin, setCheckin] = useState(() => addDays(30));
  const [checkout, setCheckout] = useState(() => addDays(32));
  const [adults, setAdults] = useState(2);
  const [results, setResults] = useState([]);
  const [searchState, setSearchState] = useState("idle");
  const [searchError, setSearchError] = useState("");
  const [prebookState, setPrebookState] = useState("idle");
  const [prebookError, setPrebookError] = useState("");
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [prebook, setPrebook] = useState(null);
  const { t } = useLanguage();
  const activeServiceKey = `travelPage.services.${activeService}`;

  const minimumCheckout = useMemo(() => {
    if (!checkin) return addDays(1);
    const date = new Date(`${checkin}T00:00:00.000Z`);
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }, [checkin]);

  async function handleSearch(event) {
    event.preventDefault();

    if (activeService !== "hotels") {
      setSearchError("Bu servis yakında açılacak. Otel araması şu anda aktif.");
      return;
    }

    if (!cityName.trim() || !checkin || !checkout || checkout <= checkin) {
      setSearchError("Şehir ve geçerli giriş-çıkış tarihlerini kontrol et.");
      return;
    }

    setSearchState("loading");
    setSearchError("");
    setResults([]);
    setPrebook(null);
    setSelectedHotel(null);

    try {
      const catalog = await listHotels({
        countryCode: "TR",
        cityName: cityName.trim(),
        limit: 20,
      });
      const hotelIds = (catalog?.hotelIds || []).slice(0, 20);

      if (!hotelIds.length) {
        throw new Error("Bu şehir için otel bulunamadı.");
      }

      const rateResponse = await searchHotelRates({
        hotelIds,
        checkin,
        checkout,
        adults,
      });
      const availableHotels = buildResults(rateResponse);

      if (!availableHotels.length) {
        throw new Error("Bu tarihlerde müsait oda bulunamadı.");
      }

      setResults(availableHotels);
      setSearchState("success");
    } catch (error) {
      setSearchState("error");
      setSearchError(error.message);
    }
  }

  async function handlePrebook(hotel) {
    setSelectedHotel(hotel);
    setPrebook(null);
    setPrebookError("");
    setPrebookState("loading");

    try {
      const response = await prebookHotel(hotel.offer.offerId);
      setPrebook(response);
      setPrebookState("success");
    } catch (error) {
      setPrebookState("error");
      setPrebookError(error.message);
    }
  }

  return (
    <main className="travelPage">
      <section className="travelHero">
        <div className="travelHeroGlow travelHeroGlow--one" />
        <div className="travelHeroGlow travelHeroGlow--two" />

        <div className="travelContainer travelHeroContent">
          <div className="travelIntro">
            <div className="travelBrandBlock">
              <span className="travelBrandMark">R</span>
              <div>
                <div className="travelBrandName" aria-label="Rota Voy">
                  <strong>ROTA</strong>
                  <span>VOY</span>
                </div>
                <small>{t("travelPage.onlineTravelAgency")}</small>
              </div>
            </div>

            <span className="travelPill">
              <Sparkles size={15} />
              {t("travelPage.pill")}
            </span>

            <h1>
              {t("travelPage.heroTitle")} <span>{t("travelPage.heroAccent")}</span>
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
            <div
              className="travelServiceTabs"
              role="tablist"
              aria-label={t("travelPage.servicesLabel")}
            >
              {services.map(({ key, icon: Icon }) => (
                <button
                  type="button"
                  key={key}
                  role="tab"
                  aria-selected={activeService === key}
                  className={activeService === key ? "active" : ""}
                  onClick={() => {
                    setActiveService(key);
                    setSearchError("");
                  }}
                >
                  <Icon size={18} />
                  <span>{t(`travelPage.services.${key}.label`)}</span>
                </button>
              ))}
            </div>

            <form className="travelSearchCard" onSubmit={handleSearch}>
              <div className="travelSearchHeading">
                <span>{t(`${activeServiceKey}.eyebrow`)}</span>
                <h2>{t(`${activeServiceKey}.title`)}</h2>
              </div>

              <div className="travelSearchGrid">
                <label className="travelField travelField--wide">
                  <span>{t(`${activeServiceKey}.locationLabel`)}</span>
                  <div>
                    <MapPin size={18} />
                    <input
                      type="text"
                      value={cityName}
                      onChange={(event) => setCityName(event.target.value)}
                      placeholder={t(`${activeServiceKey}.locationPlaceholder`)}
                      disabled={searchState === "loading"}
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
                      disabled={searchState === "loading"}
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
                      disabled={searchState === "loading"}
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
                      disabled={searchState === "loading"}
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
                  disabled={searchState === "loading"}
                >
                  {searchState === "loading" ? (
                    <LoaderCircle className="travelSpin" size={19} />
                  ) : (
                    <Search size={19} />
                  )}
                  {searchState === "loading"
                    ? "Oteller aranıyor"
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
                Otel arama ve fiyat doğrulama Nuitee sandbox üzerinden çalışır.
                Gerçek rezervasyon henüz kapalıdır.
              </p>
            </form>
          </div>
        </div>
      </section>

      {results.length > 0 && (
        <section className="travelHotelResults" aria-live="polite">
          <div className="travelContainer">
            <div className="travelResultsHeading">
              <div>
                <span>CANLI MÜSAİTLİK</span>
                <h2>{cityName} otelleri</h2>
              </div>
              <p>{results.length} müsait otel bulundu. Fiyatlar toplam konaklama içindir.</p>
            </div>

            <div className="travelHotelGrid">
              {results.map((hotel) => (
                <article className="travelHotelCard" key={hotel.hotelId}>
                  <div className="travelHotelMedia">
                    {hotel.main_photo ? (
                      <img src={hotel.main_photo} alt="" loading="lazy" />
                    ) : (
                      <Hotel size={42} aria-hidden="true" />
                    )}
                    <span>{hotel.stars || 0} yıldız</span>
                  </div>

                  <div className="travelHotelBody">
                    <div className="travelHotelRating">
                      <Star size={15} fill="currentColor" />
                      <strong>{hotel.rating || "Yeni"}</strong>
                      {hotel.review_count ? <span>{hotel.review_count} değerlendirme</span> : null}
                    </div>
                    <h3>{hotel.name || "Otel"}</h3>
                    <p>
                      <MapPin size={15} />
                      {hotel.address || hotel.city_name || cityName}
                    </p>
                    <div className="travelRoomLine">
                      <BedDouble size={17} />
                      <span>{hotel.offer?.rates?.[0]?.name || "Müsait oda"}</span>
                    </div>
                    <div className="travelHotelPrice">
                      <span>Toplam satış fiyatı</span>
                      <strong>
                        {money(
                          hotel.offer.suggestedSellingPrice.amount,
                          hotel.offer.suggestedSellingPrice.currency,
                        )}
                      </strong>
                    </div>
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
                          Doğrulanıyor
                        </>
                      ) : (
                        <>
                          Fiyatı doğrula <ArrowRight size={17} />
                        </>
                      )}
                    </button>

                    {selectedHotel?.hotelId === hotel.hotelId && (
                      <div className="travelCardPrebook" aria-live="polite">
                        {prebookState === "loading" && (
                          <p className="travelPrebookStatus">
                            <LoaderCircle className="travelSpin" size={18} />
                            Son fiyat ve oda koşulları doğrulanıyor…
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
                              <strong>Fiyat doğrulandı</strong>
                              <span>
                                {money(
                                  prebook.data.sellingPriceToUser,
                                  prebook.data.currency,
                                )}
                                {" · "}
                                {prebook.data.marginPercent}% Rotavoy marjı dahil
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled
                              title="Sandbox rezervasyonu kapalı"
                            >
                              Rezervasyon yakında
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>

          </div>
        </section>
      )}

      <section className="travelRoutesSection">
        <div className="travelContainer">
          <div className="travelSectionHeading">
            <div>
              <span>{t("travelPage.routesEyebrow")}</span>
              <h2>{t("travelPage.routesTitle")}</h2>
            </div>
            <p>{t("travelPage.routesText")}</p>
          </div>

          <div className="travelRouteGrid">
            {routeCards.map(({ key, icon: Icon }) => (
              <article className="travelRouteCard" key={key}>
                <div className="travelRouteIcon">
                  <Icon size={24} />
                </div>
                <span>{t(`travelPage.cards.${key}.badge`)}</span>
                <h3>{t(`travelPage.cards.${key}.title`)}</h3>
                <p>{t(`travelPage.cards.${key}.text`)}</p>
                <button type="button">
                  {t("travelPage.exploreRoute")} <ArrowRight size={17} />
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default Travel;
