import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import "./OrderSuccess.css";

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getLastOrder() {
  return safeParse(localStorage.getItem("kemalreis_last_order"), null);
}

function OrderSuccess() {
  const { t } = useLanguage();
  const order = getLastOrder();

  const text = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  const formatPrice = (price) => `$${Number(price || 0).toFixed(2)}`;

  if (!order) {
    return (
      <main className="orderSuccessPage">
        <section className="orderSuccessCard">
          <div className="orderSuccessIcon">🧾</div>

          <p className="orderSuccessLabel">
            {text("orderSuccessPage.noOrderTag", "No order found")}
          </p>

          <h1>
            {text(
              "orderSuccessPage.noOrderTitle",
              "There is no recent order."
            )}
          </h1>

          <span>
            {text(
              "orderSuccessPage.noOrderText",
              "Go back to products, add something to cart and complete checkout."
            )}
          </span>

          <div className="orderSuccessActions">
            <Link to="/products">
              {text("orderSuccessPage.browseProducts", "Browse Products")}
            </Link>

            <Link to="/">
              {text("orderSuccessPage.goHome", "Go Home")}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const createdDate = order.createdAt
    ? new Date(order.createdAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : text("orderSuccessPage.justNow", "Just now");

  const isPaid = order.paymentStatus === "paid";
  const isAwaitingPayment =
    order.status === "awaiting_payment" ||
    order.paymentStatus === "unpaid" ||
    order.paymentStatus === "pending";

  const statusLabel = isPaid
    ? text("orderSuccessPage.statusPaid", "Paid")
    : isAwaitingPayment
      ? text("orderSuccessPage.statusAwaitingPayment", "Awaiting payment")
      : order.status;

  const paymentMethodLabel =
    order.paymentMethod === "crypto"
      ? text("orderSuccessPage.cryptoPayment", "Crypto")
      : order.paymentMethod === "card"
        ? text("orderSuccessPage.cardPayment", "Card")
        : text("orderSuccessPage.notSelected", "Not selected");

  return (
    <main className="orderSuccessPage">
      <section className="orderSuccessCard">
        <div className="orderSuccessIcon">{isPaid ? "✅" : "⏳"}</div>

        <p className="orderSuccessLabel">
          {isPaid
            ? text("orderSuccessPage.tag", "Payment confirmed")
            : text("orderSuccessPage.paymentRequiredTag", "Payment required")}
        </p>

        <h1>
          {isPaid
            ? `${text("orderSuccessPage.thanks", "Thanks")}, ${
                order.customer?.fullName ||
                text("orderSuccessPage.customer", "customer")
              }!`
            : text("orderSuccessPage.orderCreated", "Your order was created")}
        </h1>

        <span>
          {isPaid
            ? text(
                "orderSuccessPage.text",
                "Your payment has been confirmed and your order is being processed."
              )
            : text(
                "orderSuccessPage.awaitingPaymentText",
                "Your order is safely stored and waiting for crypto payment."
              )}
        </span>

        <div className="orderSuccessMeta">
          <div>
            <small>{text("orderSuccessPage.orderId", "Order ID")}</small>
            <strong>{order.id}</strong>
          </div>

          <div>
            <small>{text("orderSuccessPage.date", "Date")}</small>
            <strong>{createdDate}</strong>
          </div>

          <div>
            <small>{text("orderSuccessPage.status", "Status")}</small>
            <strong>{statusLabel}</strong>
          </div>

          <div>
            <small>{text("orderSuccessPage.paymentMethod", "Payment")}</small>
            <strong>{paymentMethodLabel}</strong>
          </div>

          <div>
            <small>{text("orderSuccessPage.total", "Total")}</small>
            <strong>{formatPrice(order.total)}</strong>
          </div>
        </div>

        {!isPaid && order.paymentMethod === "crypto" && (
          <div className="orderSuccessPaymentNotice">
            <strong>
              {text(
                "orderSuccessPage.cryptoNextTitle",
                "Crypto payment is the next step"
              )}
            </strong>
            <p>
              {text(
                "orderSuccessPage.cryptoNextText",
                "The order and payment records are ready. Wallet transfer and blockchain confirmation will be connected next."
              )}
            </p>
          </div>
        )}

        <div className="orderSuccessDetails">
          <h2>{text("orderSuccessPage.itemsTitle", "Order Items")}</h2>

          <div className="orderSuccessItems">
            {(order.items || []).map((item) => (
              <div className="orderSuccessItem" key={item.key || item.id}>
                <div className="orderSuccessItemIcon">
                  {item.image || "🛍️"}
                </div>

                <div>
                  <h3>{item.title}</h3>
                  <p>
                    {text("orderSuccessPage.qty", "Qty")}: {item.quantity} ·{" "}
                    {formatPrice(item.price)}
                  </p>
                </div>

                <strong>
                  {formatPrice(
                    Number(item.price || 0) * Number(item.quantity || 1)
                  )}
                </strong>
              </div>
            ))}
          </div>
        </div>

        <div className="orderSuccessCustomer">
          <h2>{text("orderSuccessPage.deliveryTitle", "Delivery Info")}</h2>

          <p>
            <strong>{text("orderSuccessPage.email", "Email")}:</strong>{" "}
            {order.customer?.email}
          </p>

          <p>
            <strong>{text("orderSuccessPage.phone", "Phone")}:</strong>{" "}
            {order.customer?.phone}
          </p>

          <p>
            <strong>{text("orderSuccessPage.city", "City")}:</strong>{" "}
            {order.customer?.city}
          </p>

          <p>
            <strong>{text("orderSuccessPage.address", "Address")}:</strong>{" "}
            {order.customer?.address}
          </p>

          {order.customer?.note && (
            <p>
              <strong>{text("orderSuccessPage.note", "Note")}:</strong>{" "}
              {order.customer.note}
            </p>
          )}
        </div>

        <div className="orderSuccessActions">
          <Link to="/products">
            {text("orderSuccessPage.continueShopping", "Continue Shopping")}
          </Link>

          <Link to="/">{text("orderSuccessPage.goHome", "Go Home")}</Link>
        </div>
      </section>
    </main>
  );
}

export default OrderSuccess;
