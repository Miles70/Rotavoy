import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { useCart } from "../../context/CartContext";
import "./ProductCard.css";

const badgeTranslations = {
  en: {
    new: "New",
    stock: "In Stock",
    add: "Add to cart",
    added: "Added to cart",
  },
  tr: {
    new: "Yeni",
    stock: "Stokta",
    add: "Sepete ekle",
    added: "Sepete eklendi",
  },
  ru: {
    new: "Новинка",
    stock: "В наличии",
    add: "Добавить в корзину",
    added: "Добавлено",
  },
  ar: {
    new: "جديد",
    stock: "متوفر",
    add: "أضف إلى السلة",
    added: "تمت الإضافة",
  },
  zh: {
    new: "新品",
    stock: "有货",
    add: "加入购物车",
    added: "已加入购物车",
  },
};

function getCategoryLabel(categoryKey, t) {
  if (!categoryKey) return "General";

  const translationKey = `categories.${categoryKey}.title`;
  const translated = t(translationKey);

  if (translated !== translationKey) return translated;

  return categoryKey
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createShowcaseOldPrice(product) {
  const currentPrice = Number(product.price || 0);
  const storedOldPrice = Number(product.oldPrice || 0);

  if (storedOldPrice > currentPrice) return storedOldPrice;
  if (currentPrice <= 0) return null;

  const fingerprint = Array.from(String(product.key || product.title || "kemalreis"))
    .reduce((total, character) => total + character.charCodeAt(0), 0);
  const discountPercent = 18 + (fingerprint % 13);

  return Number((currentPrice / (1 - discountPercent / 100)).toFixed(2));
}

function ProductCard({ product, showComparePrice = false }) {
  const { t, language } = useLanguage();
  const { addToCart } = useCart();
  const [isAdded, setIsAdded] = useState(false);

  const labels = badgeTranslations[language] || badgeTranslations.en;
  const productPath = `/products/${product.key}`;

  function handleAddToCart() {
    addToCart(product);
    setIsAdded(true);

    setTimeout(() => {
      setIsAdded(false);
    }, 900);
  }

  function handleImageError(event) {
    event.currentTarget.classList.add("imageError");
  }

  function formatPrice(price) {
    return `$${Number(price || 0).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  function getBadgeLabel() {
    if (
      product.badge === "sale" &&
      product.oldPrice &&
      product.oldPrice > product.price
    ) {
      const discount = Math.round(
        ((product.oldPrice - product.price) / product.oldPrice) * 100,
      );

      return `-${discount}%`;
    }

    return labels[product.badge] || "";
  }

  const buttonLabel = isAdded ? labels.added : labels.add;
  const fallbackLetter = product.title?.charAt(0)?.toUpperCase() || "K";
  const badgeLabel = getBadgeLabel();
  const categoryLabel = getCategoryLabel(product.categoryKey, t);
  const displayOldPrice = showComparePrice
    ? createShowcaseOldPrice(product)
    : Number(product.oldPrice || 0) > Number(product.price || 0)
      ? Number(product.oldPrice)
      : null;

  return (
    <article className={isAdded ? "productCard added" : "productCard"}>
      <Link
        to={productPath}
        className="productImageLink"
        style={{ display: "block" }}
        aria-label={product.title}
      >
        <div className="productImage">
          <span className="productImageFallback" aria-hidden="true">
            {fallbackLetter}
          </span>

          {product.imageUrl && (
            <img
              src={product.imageUrl}
              alt={product.title}
              loading="lazy"
              decoding="async"
              onError={handleImageError}
            />
          )}

          {badgeLabel && (
            <span className={`productBadge ${product.badge}`}>
              {product.badge === "stock" && (
                <span className="productBadgeDot" aria-hidden="true" />
              )}

              {badgeLabel}
            </span>
          )}
        </div>
      </Link>

      <div className="productContent">
        <Link
          to={productPath}
          className="productTitleLink"
          style={{ display: "block" }}
        >
          <p className="productCategory">{categoryLabel}</p>
          <h3>{product.title}</h3>
        </Link>

        <div className="productBottom">
          <Link to={productPath} className="productPriceBlock">
            <strong>{formatPrice(product.price)}</strong>

            {displayOldPrice ? <del>{formatPrice(displayOldPrice)}</del> : null}
          </Link>

          <button
            type="button"
            className={isAdded ? "addButton added" : "addButton"}
            onClick={handleAddToCart}
            aria-label={buttonLabel}
            title={buttonLabel}
          >
            {isAdded ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M5 12.5L9.2 16.5L19 6.5"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M3 4H5L7.4 15.2C7.5 15.7 8 16 8.5 16H17.7C18.2 16 18.7 15.7 18.8 15.2L21 7H6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <circle cx="9" cy="20" r="1.4" fill="currentColor" />
                <circle cx="18" cy="20" r="1.4" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
