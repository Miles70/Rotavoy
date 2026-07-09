import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { useCart } from "../context/CartContext";
import "./Cart.css";

function Cart() {
  const { t } = useLanguage();
  const {
    cartItems,
    cartCount,
    cartTotal,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  const hasItems = cartItems.length > 0;

  return (
    <main className="cartPage">
      <section className="cartHero">
        <span>{t("cartPage.tag")}</span>
        <h1>{t("cartPage.title")}</h1>
        <p>{t("cartPage.text")}</p>
      </section>

      {!hasItems ? (
        <section className="emptyCart">
          <div className="emptyCartIcon">🛒</div>
          <h2>{t("cartPage.emptyTitle")}</h2>
          <p>{t("cartPage.emptyText")}</p>

          <Link className="cartPrimaryLink" to="/products">
            {t("cartPage.browseProducts")}
          </Link>
        </section>
      ) : (
        <section className="cartLayout">
          <div className="cartItems">
            {cartItems.map((item) => (
              <article className="cartItem" key={item.key}>
                <div className="cartItemImage">
                  <span>{item.image}</span>
                </div>

                <div className="cartItemContent">
                  <p>{t(`categories.${item.categoryKey}.title`)}</p>
                  <h2>{item.title}</h2>
                  <strong>${item.price}</strong>
                </div>

                <div className="cartQuantity">
                  <button
                    type="button"
                    onClick={() => decreaseQuantity(item.key)}
                    aria-label={t("cartPage.decrease")}
                  >
                    −
                  </button>

                  <span>{item.quantity}</span>

                  <button
                    type="button"
                    onClick={() => increaseQuantity(item.key)}
                    aria-label={t("cartPage.increase")}
                  >
                    +
                  </button>
                </div>

                <div className="cartItemTotal">
                  <strong>${item.price * item.quantity}</strong>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.key)}
                  >
                    {t("cartPage.remove")}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <aside className="cartSummary">
            <span>{t("cartPage.summaryTitle")}</span>

            <div className="summaryRow">
              <p>{t("cartPage.items")}</p>
              <strong>{cartCount}</strong>
            </div>

            <div className="summaryRow">
              <p>{t("cartPage.subtotal")}</p>
              <strong>${cartTotal}</strong>
            </div>

            <div className="summaryDivider" />

            <div className="summaryTotal">
              <p>{t("cartPage.total")}</p>
              <strong>${cartTotal}</strong>
            </div>

            <Link to="/checkout" className="checkoutButton">
              {t("cartPage.checkout")}
            </Link>

            <button type="button" className="clearCartButton" onClick={clearCart}>
              {t("cartPage.clearCart")}
            </button>
          </aside>
        </section>
      )}
    </main>
  );
}

export default Cart;