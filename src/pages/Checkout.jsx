import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, ShieldCheck, Truck, WalletCards } from "lucide-react";
import ProductThumbnail from "../components/ProductThumbnail/ProductThumbnail";
import { useCart } from "../context/CartContext";
import { useCustomerAccount } from "../context/CustomerAccountContext";
import { useLanguage } from "../i18n/LanguageContext";
import { createOrder, getShippingQuote } from "../services/orderApi";
import "./Checkout.css";
import "../styles/checkout-cj.css";

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveOrder(order) {
  const existingOrders = safeParse(localStorage.getItem("rotavoy_orders"), []);
  const nextOrders = Array.isArray(existingOrders)
    ? [order, ...existingOrders]
    : [order];

  localStorage.setItem("rotavoy_orders", JSON.stringify(nextOrders));
  localStorage.setItem("rotavoy_last_order", JSON.stringify(order));
}

function Checkout() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { cartItems, cartTotal } = useCart();
  const { defaultAddress, profile, rememberCheckoutDetails } = useCustomerAccount();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    countryCode: "",
    province: "",
    city: "",
    postalCode: "",
    address: "",
    note: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("crypto");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedLogisticName, setSelectedLogisticName] = useState("");
  const [isShippingLoading, setIsShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [shippingQuoted, setShippingQuoted] = useState(false);
  const [livePricingItems, setLivePricingItems] = useState([]);
  const [liveSubtotal, setLiveSubtotal] = useState(null);
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);

  const text = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  useEffect(() => {
    setFormData((previous) => ({
      ...previous,
      fullName: previous.fullName || defaultAddress?.fullName || profile.fullName || "",
      email: previous.email || profile.email || "",
      phone: previous.phone || defaultAddress?.phone || profile.phone || "",
      country: previous.country || defaultAddress?.country || "",
      city: previous.city || defaultAddress?.city || "",
      address: previous.address || defaultAddress?.address || "",
    }));
  }, [defaultAddress, profile]);

  const hasItems = cartItems.length > 0;
  const cartSubtotal = useMemo(() => {
    if (typeof cartTotal === "number") return cartTotal;
    return cartItems.reduce(
      (totalValue, item) => totalValue + Number(item.price || 0) * Number(item.quantity || 1),
      0,
    );
  }, [cartItems, cartTotal]);
  const livePricingByKey = useMemo(
    () => new Map(
      livePricingItems.map((item) => [String(item.productKey || ""), item]),
    ),
    [livePricingItems],
  );
  const subtotal = Number.isFinite(liveSubtotal) ? liveSubtotal : cartSubtotal;

  const selectedShipping = useMemo(
    () =>
      shippingOptions.find(
        (option) => option.logisticName === selectedLogisticName,
      ) || null,
    [selectedLogisticName, shippingOptions],
  );
  const shipping = Number(selectedShipping?.price || 0);
  const total = subtotal + shipping;
  const countryCode = formData.countryCode.trim().toUpperCase();
  const validCountryCode = /^[A-Z]{2}$/.test(countryCode);

  useEffect(() => {
    if (!hasItems || !validCountryCode) {
      setShippingOptions([]);
      setSelectedLogisticName("");
      setShippingError("");
      setShippingQuoted(false);
      setLivePricingItems([]);
      setLiveSubtotal(null);
      return undefined;
    }

    let cancelled = false;
    setShippingQuoted(false);
    const timer = window.setTimeout(() => {
      setIsShippingLoading(true);
      setShippingError("");

      getShippingQuote({
        countryCode,
        postalCode: formData.postalCode.trim(),
        items: cartItems.map((item) => ({
          productKey: item.key,
          quantity: Number(item.quantity || 1),
        })),
      })
        .then((quote) => {
          if (cancelled) return;
          const options = Array.isArray(quote?.options) ? quote.options : [];
          const quotedItems = Array.isArray(quote?.items) ? quote.items : [];
          const quotedSubtotal = Number(quote?.subtotal);
          setShippingOptions(options);
          setSelectedLogisticName(
            quote?.selected?.logisticName || options[0]?.logisticName || "",
          );
          setLivePricingItems(quotedItems);
          setLiveSubtotal(Number.isFinite(quotedSubtotal) ? quotedSubtotal : null);
          setShippingQuoted(true);
        })
        .catch((quoteError) => {
          if (cancelled) return;
          setShippingOptions([]);
          setSelectedLogisticName("");
          setLivePricingItems([]);
          setLiveSubtotal(null);
          setShippingQuoted(false);
          const quoteMessage = String(quoteError.message || "");
          setShippingError(
            quoteMessage === "No delivery method is available for this address."
              ? text(
                  "checkoutPage.shippingUnavailable",
                  "Rotavoy için bu adrese uygun teslimat yöntemi bulunamadı. Ülke kodunu (TR gibi) ve posta kodunu kontrol et.",
                )
              : quoteMessage || text("checkoutPage.shippingUnavailable", "Teslimat şu anda hesaplanamadı."),
          );
        })
        .finally(() => {
          if (!cancelled) setIsShippingLoading(false);
        });
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    cartItems,
    countryCode,
    formData.postalCode,
    hasItems,
    quoteRefreshKey,
    validCountryCode,
  ]);

  const formatPrice = (price) => `$${Number(price || 0).toFixed(2)}`;

  const getCategoryLabel = (item) => {
    if (!item.categoryKey) {
      return item.category || text("checkoutPage.generalCategory", "General");
    }
    return text(
      `categories.${item.categoryKey}.title`,
      item.category || item.categoryKey,
    );
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: name === "countryCode" ? value.toUpperCase().slice(0, 2) : value,
    }));
    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!hasItems) {
      setError(text("checkoutPage.emptyError", "Your cart is empty."));
      return;
    }

    if (
      !formData.fullName.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim() ||
      !formData.country.trim() ||
      !validCountryCode ||
      !formData.province.trim() ||
      !formData.city.trim() ||
      !formData.address.trim()
    ) {
      setError(
        text("checkoutPage.requiredError", "Please fill in all required fields."),
      );
      return;
    }

    if (!shippingQuoted || shippingError) {
      setError(
        text(
          "checkoutPage.shippingRequired",
          "Please wait until shipping is calculated.",
        ),
      );
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const order = await createOrder({
        customer: {
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          country: formData.country.trim(),
          countryCode,
          province: formData.province.trim(),
          city: formData.city.trim(),
          postalCode: formData.postalCode.trim(),
          address: formData.address.trim(),
          note: formData.note.trim(),
        },
        items: cartItems.map((item) => ({
          productKey: item.key,
          quantity: Number(item.quantity || 1),
        })),
        logisticName: selectedLogisticName,
        paymentMethod,
        expectedSubtotal: subtotal,
      });

      saveOrder(order);
      rememberCheckoutDetails(formData);
      navigate("/order-success");
    } catch (submitError) {
      setQuoteRefreshKey((value) => value + 1);
      setError(
        submitError.message ||
          text(
            "checkoutPage.serverError",
            "The order could not be created. Please try again.",
          ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasItems) {
    return (
      <main className="checkoutPage">
        <section className="checkoutEmpty">
          <span>🛒</span>
          <h1>{text("checkoutPage.emptyTitle", "Your cart is empty")}</h1>
          <p>{text("checkoutPage.emptyText", "Add some products before checkout.")}</p>
          <button
            type="button"
            className="checkoutPrimaryLink"
            onClick={() => navigate("/products")}
          >
            {text("checkoutPage.browseProducts", "Browse Products")}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="checkoutPage">
      <section className="checkoutHero">
        <p>{text("checkoutPage.tag", "Secure checkout")}</p>
        <h1>{text("checkoutPage.title", "Complete Your Order")}</h1>
        <span>
          {text(
            "checkoutPage.text",
            "Fill your delivery details and choose how you want to pay.",
          )}
        </span>
      </section>

      <section className="checkoutGrid">
        <form className="checkoutForm" onSubmit={handleSubmit}>
          <div className="checkoutFormHeader">
            <h2>{text("checkoutPage.deliveryTitle", "Delivery Details")}</h2>
            <p>{text("checkoutPage.requiredText", "Required fields are marked with *")}</p>
          </div>

          {error ? <div className="checkoutError">{error}</div> : null}

          <div className="checkoutField">
            <label htmlFor="fullName">{text("checkoutPage.fullName", "Full Name")} *</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="John Carter"
              value={formData.fullName}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="checkoutTwoColumns">
            <div className="checkoutField">
              <label htmlFor="email">{text("checkoutPage.email", "Email")} *</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
            <div className="checkoutField">
              <label htmlFor="phone">{text("checkoutPage.phone", "Phone")} *</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+90 555 555 55 55"
                value={formData.phone}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="checkoutTwoColumns">
            <div className="checkoutField">
              <label htmlFor="country">{text("checkoutPage.country", "Country")} *</label>
              <input
                id="country"
                name="country"
                type="text"
                placeholder="Türkiye"
                value={formData.country}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
            <div className="checkoutField">
              <label htmlFor="countryCode">
                {text("checkoutPage.countryCode", "Country code")} *
              </label>
              <input
                id="countryCode"
                name="countryCode"
                type="text"
                maxLength="2"
                placeholder="TR"
                value={formData.countryCode}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="checkoutTwoColumns">
            <div className="checkoutField">
              <label htmlFor="province">
                {text("checkoutPage.province", "Province / State")} *
              </label>
              <input
                id="province"
                name="province"
                type="text"
                placeholder="Antalya"
                value={formData.province}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
            <div className="checkoutField">
              <label htmlFor="city">{text("checkoutPage.city", "City")} *</label>
              <input
                id="city"
                name="city"
                type="text"
                placeholder="Antalya"
                value={formData.city}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="checkoutField">
            <label htmlFor="postalCode">
              {text("checkoutPage.postalCode", "Postal code")}
            </label>
            <input
              id="postalCode"
              name="postalCode"
              type="text"
              placeholder="07100"
              value={formData.postalCode}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="checkoutField">
            <label htmlFor="address">{text("checkoutPage.address", "Address")} *</label>
            <textarea
              id="address"
              name="address"
              rows="4"
              placeholder="Full delivery address"
              value={formData.address}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="checkoutField">
            <label htmlFor="note">{text("checkoutPage.note", "Order Note")}</label>
            <textarea
              id="note"
              name="note"
              rows="3"
              placeholder="Optional note for your order"
              value={formData.note}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <section className="checkoutPaymentSection" aria-labelledby="shipping-title">
            <div className="checkoutPaymentHeader">
              <div>
                <h2 id="shipping-title">
                  <Truck size={19} /> {text("checkoutPage.shippingMethod", "Shipping Method")}
                </h2>
                <p>
                  {isShippingLoading
                    ? text("checkoutPage.shippingLoading", "Calculating live shipping...")
                    : text(
                        "checkoutPage.shippingLive",
                        "Shipping price and route are checked live before the order is created.",
                      )}
                </p>
              </div>
            </div>

            {shippingError ? <div className="checkoutError">{shippingError}</div> : null}

            {shippingOptions.length > 0 ? (
              <div className="checkoutField">
                <select
                  aria-label={text("checkoutPage.shippingMethod", "Shipping Method")}
                  value={selectedLogisticName}
                  onChange={(event) => setSelectedLogisticName(event.target.value)}
                  disabled={isSubmitting || isShippingLoading}
                >
                  {shippingOptions.map((option) => (
                    <option value={option.logisticName} key={option.logisticName}>
                      {option.logisticName} · {formatPrice(option.price)}
                      {option.estimatedDays ? ` · ${option.estimatedDays}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : validCountryCode && !isShippingLoading && !shippingError ? (
              <p className="checkoutShippingHint">
                {shippingQuoted
                  ? text("checkoutPage.shippingIncluded", "Shipping quote is ready.")
                  : text("checkoutPage.shippingWaiting", "Waiting for shipping quote...")}
              </p>
            ) : null}
          </section>

          <section className="checkoutPaymentSection" aria-labelledby="payment-title">
            <div className="checkoutPaymentHeader">
              <div>
                <h2 id="payment-title">{text("checkoutPage.paymentTitle", "Payment Method")}</h2>
                <p>
                  {text(
                    "checkoutPage.paymentText",
                    "Crypto is available now. Card payments will be added next.",
                  )}
                </p>
              </div>
              <span>
                <ShieldCheck size={16} /> {text("checkoutPage.securePayment", "Secure")}
              </span>
            </div>

            <div className="checkoutPaymentOptions">
              <button
                type="button"
                className={`checkoutPaymentOption ${paymentMethod === "crypto" ? "active" : ""}`}
                onClick={() => setPaymentMethod("crypto")}
                disabled={isSubmitting}
                aria-pressed={paymentMethod === "crypto"}
              >
                <span className="checkoutPaymentIcon"><WalletCards size={21} /></span>
                <span>
                  <strong>{text("checkoutPage.cryptoPayment", "Crypto Payment")}</strong>
                  <small>
                    {text(
                      "checkoutPage.cryptoPaymentText",
                      "Pay from your wallet. USDT on BNB Chain is first.",
                    )}
                  </small>
                </span>
                <em>{text("checkoutPage.availableNow", "Available")}</em>
              </button>

              <button
                type="button"
                className="checkoutPaymentOption disabled"
                disabled
                aria-disabled="true"
              >
                <span className="checkoutPaymentIcon"><CreditCard size={21} /></span>
                <span>
                  <strong>{text("checkoutPage.cardPayment", "Card Payment")}</strong>
                  <small>
                    {text(
                      "checkoutPage.cardPaymentText",
                      "Visa and Mastercard support is being prepared.",
                    )}
                  </small>
                </span>
                <em>{text("checkoutPage.comingSoon", "Coming soon")}</em>
              </button>
            </div>
          </section>

          <button
            type="submit"
            className="checkoutSubmitButton"
            disabled={
              isSubmitting ||
              isShippingLoading ||
              Boolean(shippingError) ||
              !validCountryCode ||
              !shippingQuoted
            }
          >
            {isSubmitting
              ? text("checkoutPage.creatingOrder", "Creating order...")
              : text("checkoutPage.placeCryptoOrder", "Create Crypto Order")}
          </button>
        </form>

        <aside className="checkoutSummary">
          <div className="checkoutSummaryHeader">
            <h2>{text("checkoutPage.summaryTitle", "Order Summary")}</h2>
            <p>{cartItems.length} {text("checkoutPage.itemType", "item type")}</p>
          </div>

          <div className="checkoutItems">
            {cartItems.map((item) => {
              const liveItem = livePricingByKey.get(String(item.key || ""));
              const lineTotal = liveItem
                ? Number(liveItem.lineTotal || 0)
                : Number(item.price || 0) * Number(item.quantity || 1);

              return (
                <div className="checkoutItem" key={item.key || item.id}>
                  <div className="checkoutItemImage"><ProductThumbnail item={item} /></div>
                  <div className="checkoutItemInfo">
                    <h3>{item.title}</h3>
                    <p>{getCategoryLabel(item)}</p>
                    <small>{text("checkoutPage.qty", "Qty")}: {item.quantity}</small>
                  </div>
                  <strong>{formatPrice(lineTotal)}</strong>
                </div>
              );
            })}
          </div>

          <div className="checkoutTotals">
            <div>
              <span>{text("checkoutPage.subtotal", "Subtotal")}</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>
            <div>
              <span>{text("checkoutPage.shipping", "Shipping")}</span>
              <strong>
                {isShippingLoading
                  ? "..."
                  : selectedShipping
                    ? formatPrice(shipping)
                    : shippingQuoted
                      ? formatPrice(0)
                      : text("checkoutPage.calculateShipping", "Enter country code")}
              </strong>
            </div>
            <div className="checkoutTotalRow">
              <span>{text("checkoutPage.total", "Total")}</span>
              <strong>{formatPrice(total)}</strong>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default Checkout;
