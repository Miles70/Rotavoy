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
              "There is no completed order yet."
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

  return (
    <main className="orderSuccessPage">
      <section className="orderSuccessCard">
        <div className="orderSuccessIcon">✅</div>

        <p className="orderSuccessLabel">
          {text("orderSuccessPage.tag", "Order completed")}
        </p>

        <h1>
          {text("orderSuccessPage.thanks", "Thanks")},{" "}
          {order.customer?.fullName || text("orderSuccessPage.customer", "customer")}!
        </h1>

        <span>
          {text(
            "orderSuccessPage.text",
            "Your order has been received successfully."
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
            <strong>
              {order.status === "pending"
                ? text("orderSuccessPage.statusPending", "Pending")
                : order.status}
            </strong>
          </div>

          <div>
            <small>{text("orderSuccessPage.total", "Total")}</small>
            <strong>{formatPrice(order.total)}</strong>
          </div>
        </div>

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
                  {formatPrice(Number(item.price || 0) * Number(item.quantity || 1))}
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