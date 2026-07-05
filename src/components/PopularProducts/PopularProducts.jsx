import { useLanguage } from "../../i18n/LanguageContext";
import products from "../../data/products";
import ProductCard from "../ProductCard/ProductCard";
import "./PopularProducts.css";

function PopularProducts() {
  const { t } = useLanguage();

  return (
    <section className="popularProducts">
      <div className="container">
        <p className="sectionTag">{t("popularProducts.tag")}</p>

        <h2>{t("popularProducts.title")}</h2>

        <div className="productsGrid">
          {products.map((product) => (
            <ProductCard key={product.title} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default PopularProducts;