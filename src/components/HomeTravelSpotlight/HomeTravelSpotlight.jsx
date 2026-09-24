import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Hotel,
  MapPin,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { useLanguage } from "../../i18n/LanguageContext";
import "./HomeTravelSpotlight.css";

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function HomeTravelSpotlight() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const videoRef = useRef(null);
  const [cityName, setCityName] = useState("Antalya");
  const [checkin, setCheckin] = useState(() => addDays(30));
  const [checkout, setCheckout] = useState(() => addDays(32));
  const [adults, setAdults] = useState(2);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const startPlayback = () => {
      const playback = video.play();
      if (playback?.catch) playback.catch(() => {});
    };

    startPlayback();
    document.addEventListener("visibilitychange", startPlayback);
    return () => document.removeEventListener("visibilitychange", startPlayback);
  }, []);

  const minimumCheckout = useMemo(() => {
    const date = new Date(`${checkin || addDays(1)}T00:00:00.000Z`);
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }, [checkin]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!cityName.trim() || !checkin || !checkout || checkout <= checkin) return;

    const query = new URLSearchParams({
      cityName: cityName.trim(),
      checkin,
      checkout,
      adults: String(adults),
      auto: "1",
    });
    navigate(`/travel?${query.toString()}`);
  }

  return (
    <section className="homeTravelSpotlight" aria-labelledby="home-travel-title">
      <video
        ref={videoRef}
        className="homeTravelVideo"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onCanPlay={(event) => event.currentTarget.play().catch(() => {})}
        poster="/images/rotavoy-travel-caribbean-poster.webp"
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src="/images/rotavoy-travel-caribbean.mp4" type="video/mp4" />
      </video>

      <div className="homeTravelBackdrop" aria-hidden="true">
        <span />
        <span />
      </div>

      <div className="homeTravelContainer">
        <div className="homeTravelCopy">
          <span className="homeTravelBadge">
            <Hotel size={16} />
            Travel
          </span>
          <p className="homeTravelEyebrow">{t("homeTravel.eyebrow")}</p>
          <h2 id="home-travel-title">{t("homeTravel.title")}</h2>
          <p className="homeTravelText">{t("homeTravel.text")}</p>

          <div className="homeTravelFeatures">
            <span><CheckCircle2 size={17} /> {t("homeTravel.feature1")}</span>
            <span><CheckCircle2 size={17} /> {t("homeTravel.feature2")}</span>
            <span><ShieldCheck size={17} /> {t("homeTravel.feature3")}</span>
          </div>
        </div>

        <form className="homeTravelSearch" onSubmit={handleSubmit}>
          <label className="homeTravelField homeTravelField--destination">
            <span>{t("homeTravel.destination")}</span>
            <div>
              <MapPin size={18} />
              <input
                value={cityName}
                onChange={(event) => setCityName(event.target.value)}
                placeholder={t("homeTravel.destinationPlaceholder")}
                required
              />
            </div>
          </label>

          <label className="homeTravelField">
            <span>{t("homeTravel.checkin")}</span>
            <div>
              <CalendarDays size={18} />
              <input
                type="date"
                value={checkin}
                min={addDays(1)}
                onChange={(event) => {
                  setCheckin(event.target.value);
                  if (checkout <= event.target.value) setCheckout("");
                }}
                required
              />
            </div>
          </label>

          <label className="homeTravelField">
            <span>{t("homeTravel.checkout")}</span>
            <div>
              <CalendarDays size={18} />
              <input
                type="date"
                value={checkout}
                min={minimumCheckout}
                onChange={(event) => setCheckout(event.target.value)}
                required
              />
            </div>
          </label>

          <label className="homeTravelField">
            <span>{t("homeTravel.guests")}</span>
            <div>
              <UsersRound size={18} />
              <select
                value={adults}
                onChange={(event) => setAdults(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    {count === 1
                      ? t("homeTravel.guest1")
                      : `${count} ${t("homeTravel.guestsCount")}`}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <button type="submit" className="homeTravelSubmit">
            <Search size={19} />
            {t("homeTravel.search")}
            <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </section>
  );
}

export default HomeTravelSpotlight;
