import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Headphones,
  ShieldCheck,
  Star,
  WalletCards,
  Zap,
} from "lucide-react";

import categories from "../../data/categories";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStoreProducts } from "../../services/productsApi";

import "./Hero.css";

const PRODUCT_COUNT_CACHE_TTL_MS = 2 * 60 * 1000;
const PRODUCT_COUNT_CACHE_KEY_PREFIX = "rotavoy:product-count:v1:";

function formatProductCount(count) {
  const total = Number(count || 0);

  if (total >= 1000) {
    const thousands = Math.floor(total / 1000);
    return `${thousands}K+`;
  }

  return total > 0 ? String(total) : "—";
}

function getProductCountCacheKey(language) {
  return `${PRODUCT_COUNT_CACHE_KEY_PREFIX}${language}`;
}

function readProductCountCache(language) {
  if (typeof window === "undefined" || !window.sessionStorage) return null;

  const cacheKey = getProductCountCacheKey(language);

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.count) || !Number.isFinite(parsed?.cachedAt)) {
      window.sessionStorage.removeItem(cacheKey);
      return null;
    }

    return parsed;
  } catch {
    try {
      window.sessionStorage.removeItem(cacheKey);
    } catch {
      // Ignore storage failures and fall back to the API.
    }
    return null;
  }
}

function writeProductCountCache(language, count) {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  try {
    window.sessionStorage.setItem(
      getProductCountCacheKey(language),
      JSON.stringify({ count, cachedAt: Date.now() }),
    );
  } catch {
    // Ignore storage failures. The live API result still remains on screen.
  }
}

function Hero() {
  const { t, language } = useLanguage();
  const initialCache = readProductCountCache(language);
  const [productCount, setProductCount] = useState(() => Number(initialCache?.count || 0));

  useEffect(() => {
    let isCancelled = false;
    const cached = readProductCountCache(language);
    const isFresh = cached && Date.now() - cached.cachedAt < PRODUCT_COUNT_CACHE_TTL_MS;

    if (cached) {
      setProductCount(Number(cached.count || 0));
    }

    if (isFresh) {
      return () => {
        isCancelled = true;
      };
    }

    getStoreProducts({ page: 1, limit: 8, sort: "popular", language })
      .then((data) => {
        if (!isCancelled) {
          const nextCount = Number(data.pagination?.total || 0);
          setProductCount(nextCount);
          writeProductCountCache(language, nextCount);
        }
      })
      .catch(() => {
        if (!isCancelled && !cached) setProductCount(0);
      });

    return () => {
      isCancelled = true;
    };
  }, [language]);

  const stats = [
    {
      value: formatProductCount(productCount),
      label: t("productsPage.items"),
    },
    {
      value: String(categories.length),
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
