import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard/ProductCard";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../i18n/LanguageContext";
import { getProduct, getProducts } from "../services/productsApi";
import "./ProductDetails.css";

const detailTranslations = {
  en: {
    back: "Back to products",
    home: "Home",
    products: "Products",
    new: "New",
    inStock: "In stock",
    quantity: "Quantity",
    add: "Add to cart",
    added: "Added to cart",
    total: "Total",
    save: "You save",
    highlights: "Product highlights",
    details: "Product details",
    delivery: "Fast delivery",
    deliveryText: "Prepared quickly and shipped with tracking.",
    payment: "Secure payment",
    paymentText: "Protected checkout and Web3-ready infrastructure.",
    returns: "Easy returns",
    returnsText: "Simple return support for eligible orders.",
    related: "You may also like",
    relatedText: "More selected products from the same category.",
    notFound: "Product not found",
    notFoundText: "This product may have been removed or the address may be incorrect.",
    browse: "Browse all products",
    loading: "Loading product...",
    catalog: "Detailed product information",
    brand: "Brand",
    reviews: "reviews",
    image: "Product image",
  },
  tr: {
    back: "Ürünlere dön",
    home: "Ana Sayfa",
    products: "Ürünler",
    new: "Yeni",
    inStock: "Stokta",
    quantity: "Adet",
    add: "Sepete ekle",
    added: "Sepete eklendi",
    total: "Toplam",
    save: "Kazancın",
    highlights: "Ürün özellikleri",
    details: "Ürün detayları",
    delivery: "Hızlı teslimat",
    deliveryText: "Hızla hazırlanır ve takipli olarak gönderilir.",
    payment: "Güvenli ödeme",
    paymentText: "Korumalı ödeme ve Web3'e hazır altyapı.",
    returns: "Kolay iade",
    returnsText: "Uygun siparişlerde basit iade desteği.",
    related: "Bunları da beğenebilirsin",
    relatedText: "Aynı kategoriden seçilmiş diğer ürünler.",
    notFound: "Ürün bulunamadı",
    notFoundText: "Bu ürün kaldırılmış veya bağlantı hatalı olabilir.",
    browse: "Tüm ürünleri gör",
    loading: "Ürün yükleniyor...",
    catalog: "Detaylı ürün bilgisi",
    brand: "Marka",
    reviews: "değerlendirme",
    image: "Ürün görseli",
  },
  ru: {
    back: "Назад к товарам",
    home: "Главная",
    products: "Товары",
    new: "Новинка",
    inStock: "В наличии",
    quantity: "Количество",
    add: "Добавить в корзину",
    added: "Добавлено в корзину",
    total: "Итого",
    save: "Ваша экономия",
    highlights: "Особенности товара",
    details: "Характеристики",
    delivery: "Быстрая доставка",
    deliveryText: "Быстрая подготовка и отправка с отслеживанием.",
    payment: "Безопасная оплата",
    paymentText: "Защищённое оформление и Web3-инфраструктура.",
    returns: "Простой возврат",
    returnsText: "Удобная поддержка возврата подходящих заказов.",
    related: "Вам также может понравиться",
    relatedText: "Другие товары из этой категории.",
    notFound: "Товар не найден",
    notFoundText: "Товар мог быть удалён или адрес указан неверно.",
    browse: "Смотреть все товары",
    loading: "Загрузка товара...",
    catalog: "Подробная информация о товаре",
    brand: "Бренд",
    reviews: "отзывов",
    image: "Изображение товара",
  },
  ar: {
    back: "العودة إلى المنتجات",
    home: "الرئيسية",
    products: "المنتجات",
    new: "جديد",
    inStock: "متوفر",
    quantity: "الكمية",
    add: "أضف إلى السلة",
    added: "تمت الإضافة إلى السلة",
    total: "الإجمالي",
    save: "قيمة التوفير",
    highlights: "مميزات المنتج",
    details: "تفاصيل المنتج",
    delivery: "توصيل سريع",
    deliveryText: "تجهيز سريع وشحن مع إمكانية التتبع.",
    payment: "دفع آمن",
    paymentText: "دفع محمي وبنية جاهزة لتقنيات Web3.",
    returns: "إرجاع سهل",
    returnsText: "دعم مبسط لإرجاع الطلبات المؤهلة.",
    related: "قد يعجبك أيضاً",
    relatedText: "منتجات أخرى من الفئة نفسها.",
    notFound: "المنتج غير موجود",
    notFoundText: "ربما تمت إزالة المنتج أو أن الرابط غير صحيح.",
    browse: "تصفح كل المنتجات",
    loading: "جارٍ تحميل المنتج...",
    catalog: "معلومات تفصيلية عن المنتج",
    brand: "العلامة التجارية",
    reviews: "تقييم",
    image: "صورة المنتج",
  },
  zh: {
    back: "返回产品列表",
    home: "首页",
    products: "产品",
    new: "新品",
    inStock: "有货",
    quantity: "数量",
    add: "加入购物车",
    added: "已加入购物车",
    total: "总计",
    save: "节省",
    highlights: "产品亮点",
    details: "产品详情",
    delivery: "快速配送",
    deliveryText: "快速备货并提供物流追踪。",
    payment: "安全支付",
    paymentText: "受保护的结账流程和 Web3 基础设施。",
    returns: "轻松退货",
    returnsText: "符合条件的订单可获得便捷退货支持。",
    related: "你可能还喜欢",
    relatedText: "同一分类中的更多商品。",
    notFound: "未找到产品",
    notFoundText: "该产品可能已下架，或链接地址不正确。",
    browse: "浏览所有产品",
    loading: "正在加载商品...",
    catalog: "详细商品信息",
    brand: "品牌",
    reviews: "条评价",
    image: "商品图片",
  },
};

function ProductDetails() {
  const { productKey } = useParams();
  const { language } = useLanguage();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [status, setStatus] = useState("loading");
  const [selectedImage, setSelectedImage] = useState("");
  const labels = detailTranslations[language] || detailTranslations.en;

  useEffect(() => {
    const controller = new AbortController();

    async function loadProduct() {
      try {
        setStatus("loading");
        setQuantity(1);

        const payload = await getProduct(productKey, {
          signal: controller.signal,
        });
        const loadedProduct = payload.product;
        const loadedImages = Array.isArray(loadedProduct.images)
          ? loadedProduct.images.filter(Boolean)
          : [];

        setProduct(loadedProduct);
        setSelectedImage(loadedImages[0] || loadedProduct.imageUrl || "");
        setStatus("success");

        const relatedPayload = await getProducts(
          {
            category: loadedProduct.categoryKey,
            page: 1,
            limit: 5,
            sort: "popular",
          },
          { signal: controller.signal }
        );

        setRelatedProducts(
          (relatedPayload.products || [])
            .filter((item) => item.key !== loadedProduct.key)
            .slice(0, 4)
        );
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error(error);
        setProduct(null);
        setRelatedProducts([]);
        setSelectedImage("");
        setStatus(error.status === 404 ? "not-found" : "error");
      }
    }

    loadProduct();
    return () => controller.abort();
  }, [productKey]);

  function formatPrice(price) {
    return `$${Number(price || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function handleImageError(event) {
    event.currentTarget.classList.add("imageError");
  }

  function handleAddToCart() {
    addToCart(product, quantity);
    setIsAdded(true);

    window.setTimeout(() => {
      setIsAdded(false);
    }, 1100);
  }

  function getBadgeLabel() {
    if (!product) return "";

    if (product.badge === "sale" && product.oldPrice > product.price) {
      const discount = Math.round(
        ((product.oldPrice - product.price) / product.oldPrice) * 100
      );
      return `-${discount}%`;
    }

    if (product.badge === "new") return labels.new;
    if (product.badge === "stock") return labels.inStock;
    return "";
  }

  const galleryImages = useMemo(() => {
    if (!product) return [];

    return [
      ...(Array.isArray(product.images) ? product.images : []),
      product.imageUrl,
    ]
      .filter(Boolean)
      .filter((url, index, array) => array.indexOf(url) === index)
      .slice(0, 6);
  }, [product]);

  if (status === "loading") {
    return (
      <main className="productDetailsPage">
        <section className="productDetailsNotFound">
          <p>{labels.loading}</p>
        </section>
      </main>
    );
  }

  if (status !== "success" || !product) {
    return (
      <main className="productDetailsPage">
        <section className="productDetailsNotFound">
          <span>404</span>
          <h1>{labels.notFound}</h1>
          <p>{labels.notFoundText}</p>
          <Link to="/products">{labels.browse}</Link>
        </section>
      </main>
    );
  }

  const categoryTitle = product.categoryLabel || product.categoryKey;
  const savings = Math.max(
    0,
    Number(product.oldPrice || 0) - Number(product.price || 0)
  );
  const badgeLabel = getBadgeLabel();
  const fallbackLetter = product.title?.charAt(0)?.toUpperCase() || "K";
  const maximumQuantity = Math.max(1, Math.min(10, Number(product.stock) || 1));
  const features = Array.isArray(product.features) && product.features.length > 0
    ? product.features.slice(0, 8)
    : [product.brand ? `${labels.brand}: ${product.brand}` : labels.catalog];
  const detailEntries = product.details && typeof product.details === "object"
    ? Object.entries(product.details).slice(0, 10)
    : [];

  return (
    <main className="productDetailsPage">
      <nav className="productDetailsBreadcrumb" aria-label="Breadcrumb">
        <Link to="/">{labels.home}</Link>
        <span>/</span>
        <Link to="/products">{labels.products}</Link>
        <span>/</span>
        <strong>{product.title}</strong>
      </nav>

      <Link className="productDetailsBack" to="/products">
        <span aria-hidden="true">←</span>
        {labels.back}
      </Link>

      <section className="productDetailsHero">
        <div className="productDetailsMedia">
          <div className="productDetailsVisual">
            <span className="productDetailsFallback" aria-hidden="true">
              {fallbackLetter}
            </span>

            {selectedImage && (
              <img
                src={selectedImage}
                alt={product.title}
                onError={handleImageError}
              />
            )}

            {badgeLabel && (
              <span className={`productDetailsBadge ${product.badge}`}>
                {product.badge === "stock" && (
                  <span className="productDetailsBadgeDot" aria-hidden="true" />
                )}
                {badgeLabel}
              </span>
            )}
          </div>

          {galleryImages.length > 1 && (
            <div className="productDetailsThumbnails" aria-label={labels.image}>
              {galleryImages.map((imageUrl, index) => (
                <button
                  type="button"
                  className={selectedImage === imageUrl ? "active" : ""}
                  key={imageUrl}
                  onClick={() => setSelectedImage(imageUrl)}
                  aria-label={`${labels.image} ${index + 1}`}
                >
                  <img src={imageUrl} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="productDetailsContent">
          <p className="productDetailsCategory">{categoryTitle}</p>
          <h1>{product.title}</h1>

          <div className="productDetailsRating">
            <span aria-hidden="true">★</span>
            <strong>{Number(product.rating || 0).toFixed(1)}</strong>
            <small>{Number(product.reviewCount || 0).toLocaleString("en-US")} {labels.reviews}</small>
          </div>

          <p className="productDetailsDescription">
            {product.description || labels.catalog}
          </p>

          <div className="productDetailsPriceRow">
            <strong>{formatPrice(product.price)}</strong>
            {product.oldPrice && product.oldPrice > product.price && (
              <del>{formatPrice(product.oldPrice)}</del>
            )}
          </div>

          {savings > 0 && (
            <p className="productDetailsSavings">
              {labels.save}: <strong>{formatPrice(savings)}</strong>
            </p>
          )}

          <div className="productDetailsStock">
            <span aria-hidden="true" />
            {labels.inStock} ({product.stock})
          </div>

          <div className="productDetailsHighlights">
            <h2>{labels.highlights}</h2>
            <ul>
              {features.map((feature) => (
                <li key={feature}>
                  <span aria-hidden="true">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="productDetailsPurchase">
            <div className="productDetailsQuantityBlock">
              <span>{labels.quantity}</span>
              <div className="productDetailsQuantity">
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <strong>{quantity}</strong>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) =>
                      Math.min(maximumQuantity, current + 1)
                    )
                  }
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            <div className="productDetailsTotal">
              <span>{labels.total}</span>
              <strong>{formatPrice(product.price * quantity)}</strong>
            </div>
          </div>

          <button
            type="button"
            className={
              isAdded
                ? "productDetailsAddButton added"
                : "productDetailsAddButton"
            }
            onClick={handleAddToCart}
          >
            <span aria-hidden="true">{isAdded ? "✓" : "🛒"}</span>
            {isAdded ? labels.added : labels.add}
          </button>
        </div>
      </section>

      {detailEntries.length > 0 && (
        <section className="productDetailsSpecs">
          <h2>{labels.details}</h2>
          <dl>
            {detailEntries.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="productDetailsBenefits">
        <article>
          <span aria-hidden="true">🚚</span>
          <div>
            <h3>{labels.delivery}</h3>
            <p>{labels.deliveryText}</p>
          </div>
        </article>
        <article>
          <span aria-hidden="true">🔒</span>
          <div>
            <h3>{labels.payment}</h3>
            <p>{labels.paymentText}</p>
          </div>
        </article>
        <article>
          <span aria-hidden="true">↩️</span>
          <div>
            <h3>{labels.returns}</h3>
            <p>{labels.returnsText}</p>
          </div>
        </article>
      </section>

      {relatedProducts.length > 0 && (
        <section className="productDetailsRelated">
          <div className="productDetailsRelatedHeader">
            <div>
              <span>{categoryTitle}</span>
              <h2>{labels.related}</h2>
            </div>
            <p>{labels.relatedText}</p>
          </div>

          <div className="productDetailsRelatedGrid">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.key} product={relatedProduct} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default ProductDetails;
