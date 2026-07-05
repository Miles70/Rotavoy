import { useLanguage } from "../../i18n/LanguageContext";
import "./ProductCard.css";

function ProductCard({ product }) {
  const { t } = useLanguage();

  return (
    <article className="productCard">
      <div className="productImage">
        <span>{product.image}</span>
      </div>

      <div className="productContent">
        <p className="productCategory">
          {t(`products.${product.key}.category`)}
        </p>

        <h3>{t(`products.${product.key}.title`)}</h3>

        <div className="productBottom">
          <strong>${product.price}</strong>

          <button>{t("productCard.add")}</button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;