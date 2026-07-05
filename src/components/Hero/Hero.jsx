import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import "./Hero.css";

function Hero() {
  const { t } = useLanguage();

  return (
    <section className="hero">
      <div className="heroContent">
        <p className="eyebrow">{t("hero.eyebrow")}</p>

        <h1>
          {t("hero.titleFirst")} <br />
          {t("hero.titleSecond")}
        </h1>

        <p className="heroText">{t("hero.text")}</p>

        <div className="heroActions">
          <Link to="/products" className="primaryButton">
            {t("hero.exploreProducts")}
          </Link>

          <Link to="/categories" className="ghostButton">
            {t("hero.viewCategories")}
          </Link>
        </div>
      </div>
    </section>
  );
}

export default Hero;