import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard/ProductCard";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../i18n/LanguageContext";
import { getStoreProduct, getStoreProducts } from "../services/productsApi";
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
  },
};

function categoryLabel(categoryKey, t) {
  if (!categoryKey) return "";
  const translationKey = `categories.${categoryKey}.title`;
  const translated = t(translationKey);

  if (translated !== translationKey) return translated;

  return categoryKey
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPrice(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function ProductDetailsLive() {
  const { productKey } = useParams();
  const { language, t } = useLanguage();
  const { addToCart } = useCart();
  const labels = copy[language] || copy.en;
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    setIsLoading(true);
    setError("");
    setProduct(null);
    setRelatedProducts([]);
    setQuantity(1);

    getStoreProduct(productKey)
      .then(async (data) => {
        if (isCancelled) return;

        setProduct(data.product);

        try {
          const relatedData = await getStoreProducts({
            page: 1,
            limit: 6,
            category: data.product.categoryKey,
          });

          if (!isCancelled) {
            setRelatedProducts(
              (relatedData.products || [])
                .filter((item) => item.key !== data.product.key)
                .slice(0, 4),
            );
          }
        } catch {
          if (!isCancelled) setRelatedProducts([]);
        }
      })
      .catch((requestError) => {
        if (!isCancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [productKey]);

  const imageSource = useMemo(() => {
    if (!product) return "";
    return product.imageUrl || product.images?.[0] || "";
  }, [product]);

  const category = product ? categoryLabel(product.categoryKey, t) : "";
  const isInStock = Number(product?.stock || 0) > 0;

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
      <Link to="/products" className="liveProductBack">
        <ArrowLeft size={18} /> {labels.back}
      </Link>

      <section className="liveProductMain">
        <div className="liveProductVisual">
          <div className="liveProductImageFallback" aria-hidden="true">
            {product.title?.charAt(0)?.toUpperCase() || "K"}
          </div>
          {imageSource ? (
            <img
              src={imageSource}
              alt={product.title}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          {product.badge ? <span className={`liveProductBadge ${product.badge}`}>{product.badge}</span> : null}
        </div>

        <div className="liveProductInfo">
          <p className="liveProductCategory">{category}</p>
          <h1>{product.title}</h1>

          <div className="liveProductStockRow">
            <span className={isInStock ? "is-in-stock" : "is-out-of-stock"}>
              <Check size={15} /> {isInStock ? labels.inStock : labels.outOfStock}
            </span>
            <small>SKU: {product.key}</small>
          </div>

          <div className="liveProductPrice">
            <strong>{formatPrice(product.price)}</strong>
            {product.oldPrice && product.oldPrice > product.price ? (
              <del>{formatPrice(product.oldPrice)}</del>
            ) : null}
          </div>

          <p className="liveProductDescription">
            {product.description ||
              "Premium marketplace selection with secure checkout, tracked delivery and customer support."}
          </p>

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
