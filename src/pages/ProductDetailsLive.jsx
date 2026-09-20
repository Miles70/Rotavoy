import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard/ProductCard";
import Seo from "../components/Seo/Seo";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../i18n/LanguageContext";
import regionalProductDetailsTranslations from "../i18n/regionalProductDetailsTranslations";
import {
  getProductVideoUrl,
  getRelatedStoreProducts,
  getStoreProduct,
} from "../services/productsApi";
import "./ProductDetailsLive.css";

const copy = {
  en: {
    back: "Back to products",
    loading: "Loading product...",
    notFound: "Product not found",
    notFoundText: "This product may have been removed or the address may be incorrect.",
    browse: "Browse all products",
    inStock: "In stock",
    outOfStock: "Out of stock",
    quantity: "Quantity",
    variant: "Variant",
    variantNote: "The price and package contents shown belong to this selected option.",
    add: "Add to cart",
    added: "Added to cart",
    delivery: "Fast delivery",
    deliveryText: "Prepared quickly and shipped with tracking.",
    payment: "Secure payment",
    paymentText: "Protected checkout and Web3-ready infrastructure.",
    returns: "Easy returns",
    returnsText: "Simple return support for eligible orders.",
    related: "You may also like",
    relatedText: "More products from the same category.",
    highlights: "Product highlights",
    details: "Product details",
    reviews: "reviews",
    brand: "Brand",
    previousImage: "Previous image",
    nextImage: "Next image",
    fallbackDescription: "Premium marketplace selection with secure checkout, tracked delivery and customer support.",
  },
  tr: {
    back: "Ürünlere dön",
    loading: "Ürün yükleniyor...",
    notFound: "Ürün bulunamadı",
    notFoundText: "Bu ürün kaldırılmış veya bağlantı hatalı olabilir.",
    browse: "Tüm ürünleri gör",
    inStock: "Stokta",
    outOfStock: "Stokta yok",
    quantity: "Adet",
    variant: "Varyant",
    variantNote: "Gösterilen fiyat ve paket içeriği bu seçeneğe aittir.",
    add: "Sepete ekle",
    added: "Sepete eklendi",
    delivery: "Hızlı teslimat",
    deliveryText: "Hızla hazırlanır ve takipli olarak gönderilir.",
    payment: "Güvenli ödeme",
    paymentText: "Korumalı ödeme ve Web3'e hazır altyapı.",
    returns: "Kolay iade",
    returnsText: "Uygun siparişlerde basit iade desteği.",
    related: "Bunları da beğenebilirsin",
    relatedText: "Aynı kategoriden diğer ürünler.",
    highlights: "Ürün özellikleri",
    details: "Ürün detayları",
    reviews: "değerlendirme",
    brand: "Marka",
    previousImage: "Önceki görsel",
    nextImage: "Sonraki görsel",
    fallbackDescription: "Güvenli ödeme, takipli teslimat ve müşteri desteği sunan premium pazaryeri seçkisi.",
  },
  ru: {
    back: "Назад к товарам",
    loading: "Загрузка товара...",
    notFound: "Товар не найден",
    notFoundText: "Товар мог быть удалён или адрес указан неверно.",
    browse: "Смотреть все товары",
    inStock: "В наличии",
    outOfStock: "Нет в наличии",
    quantity: "Количество",
    variant: "Вариант",
    variantNote: "Указанные цена и комплектация относятся к выбранному варианту.",
    add: "Добавить в корзину",
    added: "Добавлено",
    delivery: "Быстрая доставка",
    deliveryText: "Быстрая подготовка и отправка с отслеживанием.",
    payment: "Безопасная оплата",
    paymentText: "Защищённое оформление заказа.",
    returns: "Простой возврат",
    returnsText: "Удобная поддержка возврата.",
    related: "Вам также может понравиться",
    relatedText: "Другие товары из той же категории.",
    highlights: "Особенности товара",
    details: "Характеристики",
    reviews: "отзывов",
    brand: "Бренд",
    previousImage: "Предыдущее изображение",
    nextImage: "Следующее изображение",
    fallbackDescription: "Премиальная подборка маркетплейса с безопасной оплатой, отслеживаемой доставкой и поддержкой клиентов.",
  },
  ar: {
    back: "العودة إلى المنتجات",
    loading: "جارٍ تحميل المنتج...",
    notFound: "المنتج غير موجود",
    notFoundText: "ربما تمت إزالة المنتج أو أن الرابط غير صحيح.",
    browse: "تصفح كل المنتجات",
    inStock: "متوفر",
    outOfStock: "غير متوفر",
    quantity: "الكمية",
    variant: "الخيار",
    variantNote: "السعر ومحتويات العبوة المعروضة تخص هذا الخيار المحدد.",
    add: "أضف إلى السلة",
    added: "تمت الإضافة",
    delivery: "توصيل سريع",
    deliveryText: "تجهيز سريع وشحن مع إمكانية التتبع.",
    payment: "دفع آمن",
    paymentText: "عملية دفع محمية.",
    returns: "إرجاع سهل",
    returnsText: "دعم مبسط للإرجاع.",
    related: "قد يعجبك أيضاً",
    relatedText: "منتجات أخرى من الفئة نفسها.",
    highlights: "مميزات المنتج",
    details: "تفاصيل المنتج",
    reviews: "تقييم",
    brand: "العلامة التجارية",
    previousImage: "الصورة السابقة",
    nextImage: "الصورة التالية",
    fallbackDescription: "اختيار مميز من السوق مع دفع آمن وتوصيل قابل للتتبع ودعم للعملاء.",
  },
  zh: {
    back: "返回产品列表",
    loading: "正在加载产品...",
    notFound: "未找到产品",
    notFoundText: "该产品可能已下架，或链接地址不正确。",
    browse: "浏览所有产品",
    inStock: "有货",
    outOfStock: "缺货",
    quantity: "数量",
    variant: "规格",
    variantNote: "显示的价格和包装内容仅适用于当前所选规格。",
    add: "加入购物车",
    added: "已加入购物车",
    delivery: "快速配送",
    deliveryText: "快速备货并提供物流追踪。",
    payment: "安全支付",
    paymentText: "受保护的结账流程。",
    returns: "轻松退货",
    returnsText: "便捷退货支持。",
    related: "你可能还喜欢",
    relatedText: "同一分类中的更多产品。",
    highlights: "产品亮点",
    details: "产品详情",
    reviews: "条评价",
    brand: "品牌",
    previousImage: "上一张图片",
    nextImage: "下一张图片",
    fallbackDescription: "优质商城精选，提供安全结账、可追踪配送和客户支持。",
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

function categoryLabel(product, t) {
  if (product?.categoryLabel) return product.categoryLabel;
  if (!product?.categoryKey) return "";

  const translationKey = `categories.${product.categoryKey}.title`;
  const translated = t(translationKey);

  if (translated !== translationKey) return translated;

  return product.categoryKey
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPrice(value, locale) {
  return `$${Number(value || 0).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function ProductDetailsLive() {
  const { productKey } = useParams();
  const location = useLocation();
  const { language, t } = useLanguage();
  const { addToCart } = useCart();
  const labels = regionalProductDetailsTranslations[language] || copy[language] || copy.en;
  const numberLocale = numberLocales[language] || numberLocales.en;
  const navigationProduct = location.state?.product;
  const canUseNavigationProduct = Boolean(
    navigationProduct?.key === productKey && location.state?.language === language,
  );
  const [product, setProduct] = useState(
    canUseNavigationProduct ? navigationProduct : null,
  );
  const [variants, setVariants] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(!canUseNavigationProduct);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    setIsLoading(!canUseNavigationProduct);
    setError("");
    setProduct(canUseNavigationProduct ? navigationProduct : null);
    setVariants([]);
    setRelatedProducts([]);
    setQuantity(1);
    setSelectedImageIndex(0);
    setVideoFailed(false);

    getStoreProduct(productKey, language)
      .then(async (data) => {
        if (isCancelled) return;

        setProduct(data.product);
        setVariants(data.variants || []);
        setIsLoading(false);

        try {
          const relatedData = await getRelatedStoreProducts(data.product.key, language, 8);

          if (!isCancelled) {
            setRelatedProducts(relatedData);
          }
        } catch {
          if (!isCancelled) setRelatedProducts([]);
        }
      })
      .catch((requestError) => {
        if (!isCancelled && !canUseNavigationProduct) setError(requestError.message);
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [canUseNavigationProduct, language, navigationProduct, productKey]);

  const galleryItems = useMemo(() => {
    if (!product) return [];

    const images = [
      ...(Array.isArray(product.images) ? product.images : []),
      product.imageUrl,
    ]
      .filter(Boolean)
      .filter((url, index, array) => array.indexOf(url) === index)
      .slice(0, 6);

    return [
      ...(product.hasVideo && product.videoUrl && !videoFailed
        ? [{
          type: "video",
          url: getProductVideoUrl(product.key),
          poster: product.videoPosterUrl || product.imageUrl || images[0] || "",
        }]
        : []),
      ...images.map((url) => ({ type: "image", url })),
    ];
  }, [product, videoFailed]);

  const selectedMedia = galleryItems[selectedImageIndex] || null;
  const category = product ? categoryLabel(product, t) : "";
  const isInStock = Number(product?.stock || 0) > 0;
  const features = Array.isArray(product?.features)
    ? product.features.filter(Boolean)
    : [];
  const detailEntries =
    product?.details && typeof product.details === "object" && !Array.isArray(product.details)
      ? Object.entries(product.details).filter(([, value]) => value !== "").slice(0, 12)
      : [];
  const seoDescription = String(
    product?.description || labels.fallbackDescription || "",
  )
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, 160);
  const seoImage = product?.imageUrl || product?.images?.[0] || "";
  const productPath = `/products/${encodeURIComponent(product?.key || productKey || "")}`;
  const productUrl = `https://rotavoy.com${productPath}`;
  const productStructuredData = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.title,
        description: seoDescription,
        sku: product.key,
        image: [...new Set([
          ...(Array.isArray(product.images) ? product.images : []),
          product.imageUrl,
        ].filter(Boolean))],
        ...(product.brand
          ? {
              brand: {
                "@type": "Brand",
                name: product.brand,
              },
            }
          : {}),
        ...(Number(product.rating || 0) > 0 && Number(product.reviewCount || 0) > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: Number(product.rating).toFixed(1),
                reviewCount: Number(product.reviewCount),
              },
            }
          : {}),
        offers: {
          "@type": "Offer",
          url: productUrl,
          priceCurrency: product.currency || "USD",
          price: Number(product.price || 0).toFixed(2),
          availability: isInStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: {
            "@type": "Organization",
            name: "Rotavoy",
          },
        },
      }
    : null;

  function changeImage(direction) {
    if (galleryItems.length < 2) return;

    setSelectedImageIndex((current) => {
      return (current + direction + galleryItems.length) % galleryItems.length;
    });
  }

  function handleAddToCart() {
    if (!product || !isInStock) return;

    addToCart(product, quantity);
    setIsAdded(true);
    window.setTimeout(() => setIsAdded(false), 1100);
  }

  if (isLoading) {
    return (
      <main className="liveProductState">
        <div className="liveProductSpinner" />
        <p>{labels.loading}</p>
      </main>
    );
  }

  if (!product || error) {
    return (
      <main className="liveProductState liveProductNotFound">
        <Seo
          title="Product Not Found | Rotavoy"
          description="The requested Rotavoy product is no longer available or the product address is incorrect."
          path={`/products/${encodeURIComponent(productKey || "")}`}
          noIndex
        />
        <ShoppingCart size={42} />
        <h1>{labels.notFound}</h1>
        <p>{labels.notFoundText}</p>
        <Link to="/products" className="liveProductPrimaryButton">
          {labels.browse}
        </Link>
      </main>
    );
  }

  return (
    <main className="liveProductPage">
      <Seo
        title={`${product.title} | Rotavoy`}
        description={seoDescription}
        path={productPath}
        image={seoImage}
        type="product"
        jsonLd={productStructuredData}
      />
      <Link to="/products" className="liveProductBack">
        <ArrowLeft size={18} /> {labels.back}
      </Link>

      <section className="liveProductMain">
        <div className="liveProductMedia">
          <div className="liveProductVisual">
            <div className="liveProductImageFallback" aria-hidden="true">
              {product.title?.charAt(0)?.toUpperCase() || "K"}
            </div>

            {selectedMedia?.type === "video" ? (
              <video
                key={selectedMedia.url}
                className="liveProductVideo"
                src={selectedMedia.url}
                poster={selectedMedia.poster}
                autoPlay
                muted
                loop
                playsInline
                controls
                preload="metadata"
                onError={() => {
                  setVideoFailed(true);
                  setSelectedImageIndex(0);
                }}
              />
            ) : selectedMedia?.type === "image" ? (
              <img
                key={selectedMedia.url}
                src={selectedMedia.url}
                alt={product.title}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : null}

            {galleryItems.length > 1 ? (
              <>
                <button
                  type="button"
                  className="liveProductGalleryArrow is-previous"
                  onClick={() => changeImage(-1)}
                  aria-label={labels.previousImage}
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  type="button"
                  className="liveProductGalleryArrow is-next"
                  onClick={() => changeImage(1)}
                  aria-label={labels.nextImage}
                >
                  <ChevronRight size={24} />
                </button>
                <span className="liveProductGalleryCounter">
                  {selectedImageIndex + 1} / {galleryItems.length}
                </span>
              </>
            ) : null}

            {product.badge ? (
              <span className={`liveProductBadge ${product.badge}`}>
                {product.badge === "stock" ? labels.inStock : product.badge}
              </span>
            ) : null}
          </div>

          {galleryItems.length > 1 ? (
            <div className="liveProductThumbnails">
              {galleryItems.map((item, index) => (
                <button
                  type="button"
                  key={`${item.type}-${item.url}`}
                  className={index === selectedImageIndex ? "is-active" : ""}
                  onClick={() => setSelectedImageIndex(index)}
                  aria-label={item.type === "video" ? `${product.title} video` : `${product.title} ${index + 1}`}
                >
                  <img src={item.type === "video" ? item.poster : item.url} alt="" loading="lazy" />
                  {item.type === "video" ? (
                    <span className="liveProductVideoThumbnailIcon" aria-hidden="true">
                      <Play size={18} fill="currentColor" />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="liveProductInfo">
          <p className="liveProductCategory">{category}</p>
          <h1>{product.title}</h1>

          <div className="liveProductRating">
            <Star size={17} fill="currentColor" />
            <strong>{Number(product.rating || 0).toFixed(1)}</strong>
            <span>
              {Number(product.reviewCount || 0).toLocaleString(numberLocale)} {labels.reviews}
            </span>
            {product.brand ? <small>{labels.brand}: {product.brand}</small> : null}
          </div>

          <div className="liveProductStockRow">
            <span className={isInStock ? "is-in-stock" : "is-out-of-stock"}>
              <Check size={15} /> {isInStock ? labels.inStock : labels.outOfStock}
            </span>
            <small>SKU: {product.key}</small>
          </div>

          <div className="liveProductPrice">
            <strong>{formatPrice(product.price, numberLocale)}</strong>
            {product.oldPrice && product.oldPrice > product.price ? (
              <del>{formatPrice(product.oldPrice, numberLocale)}</del>
            ) : null}
          </div>

          {variants.length > 1 ? (
            <section className="liveProductVariants" aria-label={labels.variant}>
              <span>{labels.variant}</span>
              <div>
                {variants.map((variant) => (
                  <Link
                    key={variant.key}
                    to={`/products/${variant.key}`}
                    state={{ product: variant, language }}
                    className={variant.key === product.key ? "is-active" : ""}
                    aria-current={variant.key === product.key ? "true" : undefined}
                  >
                    <strong>{variant.variantLabel || variant.title}</strong>
                    <small>{formatPrice(variant.price, numberLocale)}</small>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {product.variantLabel && product.variantLabel.toLowerCase() !== "default" ? (
            <div className="liveProductVariantNotice">
              <strong>{labels.variant}: {product.variantLabel}</strong>
              <span>{labels.variantNote || copy.en.variantNote}</span>
            </div>
          ) : null}

          <p className="liveProductDescription">
            {product.description || labels.fallbackDescription}
          </p>

          {features.length ? (
            <section className="liveProductHighlights">
              <h2>{labels.highlights}</h2>
              <ul>
                {features.map((feature) => (
                  <li key={feature}>
                    <Check size={16} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="liveProductBuyRow">
            <div className="liveProductQuantity">
              <span>{labels.quantity}</span>
              <div>
                <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>
                  <Minus size={16} />
                </button>
                <strong>{quantity}</strong>
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.min(Number(product.stock) || 99, current + 1))}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <button
              type="button"
              className={isAdded ? "liveProductPrimaryButton is-added" : "liveProductPrimaryButton"}
              disabled={!isInStock}
              onClick={handleAddToCart}
            >
              <ShoppingCart size={19} /> {isAdded ? labels.added : labels.add}
            </button>
          </div>

          <div className="liveProductTrustGrid">
            <article>
              <Truck size={21} />
              <div><strong>{labels.delivery}</strong><span>{labels.deliveryText}</span></div>
            </article>
            <article>
              <ShieldCheck size={21} />
              <div><strong>{labels.payment}</strong><span>{labels.paymentText}</span></div>
            </article>
            <article>
              <RotateCcw size={21} />
              <div><strong>{labels.returns}</strong><span>{labels.returnsText}</span></div>
            </article>
          </div>
        </div>
      </section>

      {detailEntries.length ? (
        <section className="liveProductSpecs">
          <div className="liveProductSpecsHeader">
            <span>{category}</span>
            <h2>{labels.details}</h2>
          </div>
          <dl>
            {detailEntries.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {relatedProducts.length ? (
        <section className="liveProductRelated">
          <div>
            <span>{labels.related}</span>
            <h2>{labels.related}</h2>
            <p>{labels.relatedText}</p>
          </div>
          <div className="productsGrid">
            {relatedProducts.map((item) => (
              <ProductCard key={item.key} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default ProductDetailsLive;
