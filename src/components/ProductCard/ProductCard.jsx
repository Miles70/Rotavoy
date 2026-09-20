import { useRef, useState } from "react";
import { Heart, Play } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { useCart } from "../../context/CartContext";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { useCustomerAccount } from "../../context/CustomerAccountContext";
import { getProductVideoUrl } from "../../services/productsApi";
import "./ProductCard.css";
import "./ProductFavorite.css";

const badgeTranslations = {
  en: {
    new: "New",
    stock: "In Stock",
    outOfStock: "Out of stock",
    add: "Add to cart",
    added: "Added to cart",
    options: "Choose options",
  },
  tr: {
    new: "Yeni",
    stock: "Stokta",
    outOfStock: "Stokta yok",
    add: "Sepete ekle",
    added: "Sepete eklendi",
    options: "Seçenekleri gör",
  },
  ru: {
    new: "Новинка",
    stock: "В наличии",
    outOfStock: "Нет в наличии",
    add: "Добавить в корзину",
    added: "Добавлено",
    options: "Выбрать вариант",
  },
  ar: {
    new: "جديد",
    stock: "متوفر",
    outOfStock: "غير متوفر",
    add: "أضف إلى السلة",
    added: "تمت الإضافة",
    options: "اختر الخيار",
  },
  zh: {
    new: "新品",
    stock: "有货",
    outOfStock: "缺货",
    add: "加入购物车",
    added: "已加入购物车",
    options: "选择规格",
  },
  es: {
    new: "Nuevo",
    stock: "En stock",
    outOfStock: "Rupture de stock",
    outOfStock: "Agotado",
    add: "Añadir al carrito",
    added: "Añadido al carrito",
    options: "Elegir opciones",
  },
  pt: {
    new: "Novo",
    stock: "Em estoque",
    outOfStock: "Fora de estoque",
    add: "Adicionar ao carrinho",
    added: "Adicionado ao carrinho",
    options: "Escolher opções",
  },
  fr: {
    new: "Nouveau",
    stock: "En stock",
    add: "Ajouter au panier",
    added: "Ajouté au panier",
    options: "Choisir les options",
  },
  de: {
    new: "Neu",
    stock: "Auf Lager",
    outOfStock: "Nicht auf Lager",
    add: "In den Warenkorb",
    added: "Zum Warenkorb hinzugefügt",
    options: "Optionen wählen",
  },
  it: {
    new: "Nuovo",
    stock: "Disponibile",
    outOfStock: "Esaurito",
    add: "Aggiungi al carrello",
    added: "Aggiunto al carrello",
    options: "Scegli opzioni",
  },
};

const numberLocales = {
  en: "en-US",
  tr: "tr-TR",
  ru: "ru-RU",
  ar: "ar-SA",
  zh: "zh-CN",
  es: "es-ES",
  pt: "pt-BR",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
};

function ProductCard({ product }) {
  const { t, language } = useLanguage();
  const { addToCart } = useCart();
  const { isAuthenticated, openAuthModal } = useCustomerAuth();
  const { isFavorite, toggleFavorite } = useCustomerAccount();
  const navigate = useNavigate();
  const [isAdded, setIsAdded] = useState(false);
  const [videoRequested, setVideoRequested] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef(null);

  const labels = badgeTranslations[language] || badgeTranslations.en;
  const numberLocale = numberLocales[language] || numberLocales.en;
  const productPath = `/products/${product.key}`;
  const favorite = isFavorite(product.key);
  const hasMultipleVariants = Number(product.variantCount || 0) > 1;
  const isInStock = Number(product.stock || 0) > 0;
  const variantLabel = String(product.variantLabel || "").trim();
  const showVariantLabel = variantLabel && variantLabel.toLowerCase() !== "default";
  const hasVideo = Boolean(product.hasVideo && product.videoUrl && !videoFailed);

  const text = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  function handleAddToCart() {
    if (!isInStock) return;

    if (hasMultipleVariants) {
      navigate(productPath, { state: { product, language } });
      return;
    }

    addToCart(product);
    setIsAdded(true);

    setTimeout(() => {
      setIsAdded(false);
    }, 900);
  }

  function handleFavoriteClick() {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    toggleFavorite(product);
  }

  function handleImageError(event) {
    event.currentTarget.classList.add("imageError");
  }

  function handleVideoEnter() {
    if (!hasVideo) return;
    setVideoRequested(true);
    window.requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => undefined);
    });
  }

  function handleVideoLeave() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  }

  function formatPrice(price) {
    return `$${Number(price || 0).toLocaleString(numberLocale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  function getBadgeLabel() {
    if (!isInStock) return labels.outOfStock;

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

  const buttonLabel = !isInStock
    ? labels.outOfStock
    : hasMultipleVariants
      ? labels.options
      : isAdded
        ? labels.added
        : labels.add;
  const favoriteLabel = favorite
    ? text("account.removeFavorite", "Remove from favorites")
    : text("account.addFavorite", "Add to favorites");
  const fallbackLetter = product.title?.charAt(0)?.toUpperCase() || "G";
  const badgeLabel = getBadgeLabel();
  const badgeClass = isInStock ? product.badge : "out-of-stock";
  const displayOldPrice =
    !hasMultipleVariants && Number(product.oldPrice || 0) > Number(product.price || 0)
      ? Number(product.oldPrice)
      : null;
  // Grouped CJ cards point to one concrete active variant (the cheapest one,
  // selected by the backend). Show that variant's actual sale price as a
  // single amount; other variant prices remain visible after opening details.
  const displayPrice = formatPrice(product.price);

  return (
    <article className={isAdded ? "productCard added" : "productCard"}>
      <div
        className={`productImageShell${hasVideo ? " hasVideo" : ""}`}
        onMouseEnter={handleVideoEnter}
        onMouseLeave={handleVideoLeave}
      >
        <Link
          to={productPath}
          state={{ product, language }}
          className="productImageLink"
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

            {hasVideo && videoRequested && (
              <video
                ref={videoRef}
                className="productHoverVideo"
                src={getProductVideoUrl(product.key)}
                poster={product.videoPosterUrl || product.imageUrl}
                muted
                loop
                playsInline
                preload="metadata"
                aria-hidden="true"
                onCanPlay={(event) => event.currentTarget.play().catch(() => undefined)}
                onError={() => setVideoFailed(true)}
              />
            )}

            {hasVideo && (
              <span className="productVideoBadge" aria-hidden="true">
                <Play size={12} fill="currentColor" />
                Video
              </span>
            )}

            {badgeLabel && (
              <span className={`productBadge ${badgeClass}`}>
                {badgeClass === "stock" && (
                  <span className="productBadgeDot" aria-hidden="true" />
                )}
                {badgeLabel}
              </span>
            )}
          </div>
        </Link>

        <button
          type="button"
          className={`productFavoriteButton${favorite ? " active" : ""}`}
          onClick={handleFavoriteClick}
          aria-label={favoriteLabel}
          title={favoriteLabel}
          aria-pressed={favorite}
        >
          <Heart size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="productContent">
        {showVariantLabel ? (
          <Link to={productPath} state={{ product, language }} className="productVariantSummary" title={variantLabel}>
            {variantLabel}
          </Link>
        ) : null}
        <Link to={productPath} state={{ product, language }} className="productTitleLink">
          <h3>{product.title}</h3>
        </Link>

        <div className="productBottom">
          <Link to={productPath} state={{ product, language }} className="productPriceBlock">
            <strong>{displayPrice}</strong>
            {displayOldPrice ? <del>{formatPrice(displayOldPrice)}</del> : null}
          </Link>

          <button
            type="button"
            className={isAdded ? "addButton added" : "addButton"}
            onClick={handleAddToCart}
            disabled={!isInStock}
            aria-label={buttonLabel}
            title={buttonLabel}
          >
            {isAdded && !hasMultipleVariants ? (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12.5L9.2 16.5L19 6.5"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
