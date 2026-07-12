import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../ProductCard/ProductCard";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStoreProducts } from "../../services/productsApi";
import "./PopularProducts.css";

function PopularProducts() {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    getStoreProducts({ page: 1, limit: 25 })
      .then((data) => {
        if (!isCancelled) {
          setProducts(data.products || []);
          setError("");
        }
      })
      .catch((requestError) => {
        if (!isCancelled) {
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
  }, []);

  return (
    <section className="popularProducts">
      <div className="popularProductsHeader">
        <span>{t("popularProducts.tag")}</span>
        <h2>{t("popularProducts.title")}</h2>
        <p>{t("popularProducts.text")}</p>
      </div>

      {isLoading ? (
        <div className="popularProductsGrid productsLoadingGrid">
          {Array.from({ length: 8 }, (_, index) => (
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
