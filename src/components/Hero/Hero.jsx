import { Link } from "react-router-dom";
import {
  ArrowRight,
  Headphones,
  ShieldCheck,
  Star,
  WalletCards,
  Zap,
} from "lucide-react";

import { useLanguage } from "../../i18n/LanguageContext";

import "./Hero.css";

function Hero() {
  const { t } = useLanguage();

  const stats = [
    {
      value: "8+",
      label: t("productsPage.items"),
    },
    {
      value: "4",
      label: t("nav.categories"),
    },
    {
      value: "Web3",
      label: t("checkoutPage.tag"),
    },
    {
      value: "7/24",
      label: t("footer.support"),
    },
  ];

  const trustItems = [
    {
      icon: ShieldCheck,
      label: t("checkoutPage.tag"),
    },
    {
      icon: Zap,
      label: t("deals.tag"),
    },
    {
      icon: WalletCards,
      label: t("header.connectWallet"),
    },
    {
      icon: Headphones,
      label: t("footer.support"),
    },
  ];

  return (
    <section className="hero">
      <div className="heroGlow heroGlowLeft" />
      <div className="heroGlow heroGlowRight" />

      <div className="heroContent">
        <p className="eyebrow">
          <span className="eyebrowDot" />
          {t("hero.eyebrow")}
        </p>

        <h1>
          <span className="heroTitleLine">{t("hero.titleFirst")}</span>

          <span className="heroTitleLine heroGradientText">
            {t("hero.titleSecond")}
          </span>
        </h1>

        <p className="heroText">{t("hero.text")}</p>

        <div className="heroActions">
          <Link to="/products" className="primaryButton">
            {t("hero.exploreProducts")}
            <ArrowRight size={18} />
          </Link>

          <Link to="/categories" className="ghostButton">
            {t("hero.viewCategories")}
          </Link>
        </div>

        <div className="heroReview">
          <span className="heroStars" aria-label="5 stars">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} size={15} fill="currentColor" />
            ))}
          </span>

          <strong>4.7</strong>

          <span className="heroReviewDivider">·</span>

          <span>{t("popularProducts.title")}</span>
        </div>

        <div className="heroStats">
          {stats.map((stat) => (
            <div className="heroStat" key={`${stat.value}-${stat.label}`}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="heroTrustBar">
        <div className="heroTrustInner">
          {trustItems.map(({ icon: Icon, label }) => (
            <div className="heroTrustItem" key={label}>
              <Icon size={18} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Hero;