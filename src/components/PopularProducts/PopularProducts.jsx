import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../ProductCard/ProductCard";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStoreProducts } from "../../services/productsApi";
import "./PopularProducts.css";

const HOME_PRODUCT_LIMIT = 100;
const HOME_PRODUCT_CACHE_TTL_MS = 2 * 60 * 1000;
const HOME_PRODUCT_CACHE_KEY_PREFIX = "rotavoy:home-products:v1:";
const homeProductCache = new Map();

function getSessionCacheKey(language) {
  return `${HOME_PRODUCT_CACHE_KEY_PREFIX}${language}`;
}

function readSessionCache(language) {
  if (typeof window === "undefined" || !window.sessionStorage) return null;

  const cacheKey = getSessionCacheKey(language);

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.products) || !Number.isFinite(parsed?.cachedAt)) {
      window.sessionStorage.removeItem(cacheKey);
      return null;
    }

    return parsed;
  } catch {
    try {
      window.sessionStorage.removeItem(cacheKey);
    } catch {
      // Ignore storage access failures and fall back to the API.
    }
    return null;
  }
}

function writeSessionCache(language, value) {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  try {
    window.sessionStorage.setItem(getSessionCacheKey(language), JSON.stringify(value));
  } catch {
    // Storage may be unavailable or full. In-memory caching still works.
  }
}

function getCachedHomeProducts(language) {
  const memoryCache = homeProductCache.get(language);
  if (memoryCache) return memoryCache;

  const sessionCache = readSessionCache(language);
  if (sessionCache) homeProductCache.set(language, sessionCache);
  return sessionCache;
}

function PopularProducts() {
  const { t, language } = useLanguage();
  const initialCache = getCachedHomeProducts(language);
  const [products, setProducts] = useState(() => initialCache?.products || []);
  const [isLoading, setIsLoading] = useState(() => !initialCache);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;
    const cached = getCachedHomeProducts(language);
    const isFresh = cached && Date.now() - cached.cachedAt < HOME_PRODUCT_CACHE_TTL_MS;

    if (cached) {
      setProducts(cached.products);
      setIsLoading(false);
      setError("");
    } else {
      setIsLoading(true);
      setError("");
    }

    if (isFresh) {
      return () => {
        isCancelled = true;
      };
    }

    getStoreProducts({ page: 1, limit: HOME_PRODUCT_LIMIT, sort: "showcase", language })
      .then((data) => {
        if (!isCancelled) {
          const nextProducts = data.products || [];
          const nextCache = {
            products: nextProducts,
            cachedAt: Date.now(),
          };

          homeProductCache.set(language, nextCache);
          writeSessionCache(language, nextCache);
          setProducts(nextProducts);
          setError("");
        }
      })
      .catch((requestError) => {
        if (!isCancelled && !cached) {
          setProducts([]);
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [language]);

  return (
    <section className="popularProducts">
      <div className="popularProductsHeader">
        <span>{t("popularProducts.tag")}</span>
        <h2>{t("popularProducts.title")}</h2>
        <p>{t("popularProducts.text")}</p>
      </div>

      {isLoading ? (
        <div className="popularProductsGrid productsLoadingGrid">
          {Array.from({ length: 12 }, (_, index) => (
            <div className="productLoadingCard" key={index} />
          ))}
        </div>
      ) : null}

      {!isLoading && !error ? (
        <div className="popularProductsGrid">
          {products.map((product) => (
            <ProductCard key={product.key} product={product} />
          ))}
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="popularProductsError">
          <p>Products could not be loaded. Make sure the backend server is running.</p>
        </div>
      ) : null}

      {!isLoading && products.length ? (
        <div className="popularProductsFooter">
          <Link to="/products">View all products</Link>
        </div>
      ) : null}
    </section>
  );
}

export default PopularProducts;
