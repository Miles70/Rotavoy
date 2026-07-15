import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, ShieldCheck, WalletCards } from "lucide-react";
import ProductThumbnail from "../components/ProductThumbnail/ProductThumbnail";
import { useLanguage } from "../i18n/LanguageContext";
import { useCart } from "../context/CartContext";
import { useCustomerAccount } from "../context/CustomerAccountContext";
import { createOrder } from "../services/orderApi";
import "./Checkout.css";

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveOrder(order) {
  const existingOrders = safeParse(localStorage.getItem("masterota_orders"), []);
  const nextOrders = Array.isArray(existingOrders)
    ? [order, ...existingOrders]
    : [order];

  localStorage.setItem("masterota_orders", JSON.stringify(nextOrders));
  localStorage.setItem("masterota_last_order", JSON.stringify(order));
}

function Checkout() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { cartItems, cartTotal } = useCart();
  const {
    defaultAddress,
    profile,
    rememberCheckoutDetails,
  } = useCustomerAccount();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    city: "",
    address: "",
    note: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("crypto");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData((previous) => ({
      ...previous,
      fullName:
        previous.fullName ||
        defaultAddress?.fullName ||
        profile.fullName ||
        "",
      email: previous.email || profile.email || "",
      phone:
        previous.phone ||
        defaultAddress?.phone ||
        profile.phone ||
        "",
      city: previous.city || defaultAddress?.city || "",
      address: previous.address || defaultAddress?.address || "",
    }));
  }, [defaultAddress, profile]);

  const text = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  const hasItems = cartItems.length > 0;

  const subtotal = useMemo(() => {
    if (typeof cartTotal === "number") return cartTotal;

    return cartItems.reduce((total, item) => {
      return total + Number(item.price || 0) * Number(item.quantity || 1);
    }, 0);
  }, [cartItems, cartTotal]);

  const shipping = 0;
  const total = subtotal + shipping;

  const formatPrice = (price) => `$${Number(price || 0).toFixed(2)}`;

  const getCategoryLabel = (item) => {
    if (item.categoryKey) {
      return text(
        `categories.${item.categoryKey}.title`,
        item.category || text("checkoutPage.generalCategory", "General"),
      );
    }

    return item.category || text("checkoutPage.generalCategory", "General");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
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
      !formData.city.trim() ||
      !formData.address.trim()
    ) {
      setError(
        text("checkoutPage.requiredError", "Please fill in all required fields."),
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
          city: formData.city.trim(),
          address: formData.address.trim(),
          note: formData.note.trim(),
        },
        items: cartItems.map((item) => ({
          productKey: item.key,
          quantity: Number(item.quantity || 1),
        })),
        paymentMethod,
      });

      saveOrder(order);
      rememberCheckoutDetails(formData);
      navigate("/order-success");
    } catch (submitError) {
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
          <p>
            {text(
              "checkoutPage.emptyText",
              "Add some products before checkout.",
            )}
          </p>

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
            <p>
              {text(
                "checkoutPage.requiredText",
                "Required fields are marked with *",
              )}
            </p>
          </div>

          {error && <div className="checkoutError">{error}</div>}

          <div className="checkoutField">
            <label htmlFor="fullName">
              {text("checkoutPage.fullName", "Full Name")} *
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              placeholder={text("checkoutPage.fullNamePlaceholder", "John Carter")}
              value={formData.fullName}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="checkoutTwoColumns">
            <div className="checkoutField">
              <label htmlFor="email">
                {text("checkoutPage.email", "Email")} *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder={text(
                  "checkoutPage.emailPlaceholder",
                  "john@example.com",
                )}
                value={formData.email}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="checkoutField">
              <label htmlFor="phone">
                {text("checkoutPage.phone", "Phone")} *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder={text(
                  "checkoutPage.phonePlaceholder",
                  "+90 555 555 55 55",
                )}
                value={formData.phone}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="checkoutField">
            <label htmlFor="city">
              {text("checkoutPage.city", "City")} *
            </label>
            <input
              id="city"
              name="city"
              type="text"
              placeholder={text("checkoutPage.cityPlaceholder", "Antalya")}
              value={formData.city}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="checkoutField">
            <label htmlFor="address">
              {text("checkoutPage.address", "Address")} *
            </label>
            <textarea
              id="address"
              name="address"
              rows="4"
              placeholder={text(
                "checkoutPage.addressPlaceholder",
                "Full delivery address",
              )}
              value={formData.address}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="checkoutField">
            <label htmlFor="note">
              {text("checkoutPage.note", "Order Note")}
            </label>
            <textarea
              id="note"
              name="note"
              rows="3"
              placeholder={text(
                "checkoutPage.notePlaceholder",
                "Optional note for your order",
              )}
              value={formData.note}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <section className="checkoutPaymentSection" aria-labelledby="payment-title">
            <div className="checkoutPaymentHeader">
              <div>
                <h2 id="payment-title">
                  {text("checkoutPage.paymentTitle", "Payment Method")}
                </h2>
                <p>
                  {text(
                    "checkoutPage.paymentText",
                    "Crypto is available now. Card payments will be added next.",
                  )}
                </p>
              </div>

              <span>
                <ShieldCheck size={16} />
                {text("checkoutPage.securePayment", "Secure")}
              </span>
            </div>

            <div className="checkoutPaymentOptions">
              <button
                type="button"
                className={`checkoutPaymentOption ${
                  paymentMethod === "crypto" ? "active" : ""
                }`}
                onClick={() => setPaymentMethod("crypto")}
                disabled={isSubmitting}
                aria-pressed={paymentMethod === "crypto"}
              >
                <span className="checkoutPaymentIcon">
                  <WalletCards size={21} />
                </span>

                <span>
                  <strong>
                    {text("checkoutPage.cryptoPayment", "Crypto Payment")}
                  </strong>
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
                <span className="checkoutPaymentIcon">
                  <CreditCard size={21} />
                </span>

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
            disabled={isSubmitting}
          >
            {isSubmitting
              ? text("checkoutPage.creatingOrder", "Creating order...")
              : text("checkoutPage.placeCryptoOrder", "Create Crypto Order")}
          </button>
        </form>

        <aside className="checkoutSummary">
          <div className="checkoutSummaryHeader">
            <h2>{text("checkoutPage.summaryTitle", "Order Summary")}</h2>
            <p>
              {cartItems.length} {text("checkoutPage.itemType", "item type")}
            </p>
          </div>

          <div className="checkoutItems">
            {cartItems.map((item) => (
              <div className="checkoutItem" key={item.key || item.id}>
                <div className="checkoutItemImage">
                  <ProductThumbnail item={item} />
                </div>

                <div className="checkoutItemInfo">
                  <h3>{item.title}</h3>
                  <p>{getCategoryLabel(item)}</p>
                  <small>
                    {text("checkoutPage.qty", "Qty")}: {item.quantity}
                  </small>
                </div>

                <strong>
                  {formatPrice(
                    Number(item.price || 0) * Number(item.quantity || 1),
                  )}
                </strong>
              </div>
            ))}
          </div>

          <div className="checkoutTotals">
            <div>
              <span>{text("checkoutPage.subtotal", "Subtotal")}</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>

            <div>
              <span>{text("checkoutPage.shipping", "Shipping")}</span>
              <strong>
                {shipping === 0
                  ? text("checkoutPage.freeShipping", "Free")
                  : formatPrice(shipping)}
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
