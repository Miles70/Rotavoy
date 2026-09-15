import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../ProductCard/ProductCard";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStoreProducts } from "../../services/productsApi";
import "./PopularProducts.css";

const HOME_PRODUCT_LIMIT = 100;
const HOME_PRODUCT_CACHE_TTL_MS = 2 * 60 * 1000;
const homeProductCache = new Map();

function getCachedHomeProducts(language) {
  return homeProductCache.get(language) || null;
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
          homeProductCache.set(language, {
            products: nextProducts,
            cachedAt: Date.now(),
          });
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
