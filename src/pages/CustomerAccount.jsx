import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Heart,
  Home,
  LogOut,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserRound,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import CustomerAvatar from "../components/CustomerAvatar/CustomerAvatar";
import ProductCard from "../components/ProductCard/ProductCard";
import { useCustomerAccount } from "../context/CustomerAccountContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useLanguage } from "../i18n/LanguageContext";

import "./CustomerAccount.css";

const EMPTY_ADDRESS = {
  label: "",
  fullName: "",
  phone: "",
  city: "",
  country: "",
  address: "",
};

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getOrders() {
  const orders = safeParse(localStorage.getItem("rotavoy_orders"), []);
  return Array.isArray(orders) ? orders : [];
}

function getOrderId(order) {
  return order.orderId || order._id || order.id || "—";
}

function getOrderTotal(order) {
  return Number(order.total ?? order.totals?.total ?? order.amount ?? 0);
}

function getOrderItems(order) {
  return Array.isArray(order.items) ? order.items : [];
}

function CustomerAccount() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const {
    address,
    authType,
    displayName,
    isAuthenticated,
    isGuest,
    manageWallet,
    openAuthModal,
    profileEmail,
    signOut,
    upgradeGuestAccount,
  } = useCustomerAuth();
  const {
    addAddress,
    addresses,
    favoriteProducts,
    profile,
    removeAddress,
    saveProfile,
    setDefaultAddress,
  } = useCustomerAccount();

  const [orders, setOrders] = useState(getOrders);
  const [profileForm, setProfileForm] = useState(profile);
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS);
  const [profileSaved, setProfileSaved] = useState(false);

  const section = location.pathname.split("/")[2] || "overview";
  const text = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  const locale = {
    tr: "tr-TR",
    ru: "ru-RU",
    ar: "ar-SA",
    zh: "zh-CN",
  }[language] || "en-US";

  useEffect(() => {
    setOrders(getOrders());
  }, [location.pathname]);

  useEffect(() => {
    setProfileForm(profile);
  }, [profile]);

  const recentOrders = useMemo(() => orders.slice(0, 3), [orders]);

  const menuItems = [
    { to: "/account", end: true, label: text("account.accountHome", "My account"), icon: Home },
    { to: "/account/orders", label: text("account.orders", "My orders"), icon: Package },
    { to: "/account/favorites", label: text("account.favorites", "Favorites"), icon: Heart },
    { to: "/account/addresses", label: text("account.addresses", "Addresses"), icon: MapPin },
    { to: "/account/profile", label: text("account.profile", "Profile details"), icon: UserRound },
    { to: "/account/security", label: text("account.security", "Account & security"), icon: ShieldCheck },
  ];

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function formatPrice(value) {
    return `$${Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  function handleProfileSubmit(event) {
    event.preventDefault();
    saveProfile({
      fullName: profileForm.fullName.trim(),
      email: profileForm.email.trim(),
      phone: profileForm.phone.trim(),
    });
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 1600);
  }

  function handleAddressSubmit(event) {
    event.preventDefault();

    if (!addressForm.city.trim() || !addressForm.address.trim()) {
      return;
    }

    addAddress({
      ...addressForm,
      fullName: addressForm.fullName || profile.fullName,
      phone: addressForm.phone || profile.phone,
    });
    setAddressForm(EMPTY_ADDRESS);
  }

  function renderOrders(orderList) {
    if (orderList.length === 0) {
      return (
        <div className="customerAccountEmpty">
          <ShoppingBag size={32} />
          <h3>{text("account.noOrders", "No orders yet.")}</h3>
          <p>{text("account.noOrdersText", "Your completed orders will appear here.")}</p>
          <Link to="/products">{text("account.shopNow", "Start shopping")}</Link>
        </div>
      );
    }

    return (
      <div className="customerOrderList">
        {orderList.map((order, index) => {
          const orderId = getOrderId(order);
          const items = getOrderItems(order);

          return (
            <article className="customerOrderCard" key={`${orderId}-${index}`}>
              <div className="customerOrderIcon">
                <Package size={21} />
              </div>
              <div className="customerOrderMain">
                <div>
                  <span>{text("account.order", "Order")}</span>
                  <strong>#{String(orderId).slice(-12)}</strong>
                </div>
                <small>
                  {formatDate(order.createdAt || order.date)} · {items.length} {text("account.items", "items")}
                </small>
              </div>
              <span className="customerOrderStatus">
                {order.status || "Pending"}
              </span>
              <strong className="customerOrderTotal">
                {formatPrice(getOrderTotal(order))}
              </strong>
            </article>
          );
        })}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="customerAccountGate">
        <div className="customerAccountGateIcon">
          <UserRound size={38} />
        </div>
        <h1>{text("account.signInTitle", "Sign in to open your account")}</h1>
        <p>{text("account.signInText", "Track orders, save addresses and keep your favorites ready.")}</p>
        <button type="button" onClick={openAuthModal}>
          {text("account.signInButton", "Sign in or continue as guest")}
          <ArrowRight size={18} />
        </button>
      </main>
    );
  }

  return (
    <main className="customerAccountPage">
      <section className="customerAccountHero">
        <div className="customerAccountIdentity">
          <CustomerAvatar size="large" />
          <div>
            <span>{isGuest ? text("auth.method.guest", "Guest") : text(`auth.method.${authType}`, "Account")}</span>
            <h1>{displayName || text("account.accountHome", "My account")}</h1>
            <p>{profileEmail || address || text("account.guestSecurityText", "This session is stored only on this device.")}</p>
          </div>
        </div>

        {isGuest && (
          <button className="customerAccountUpgrade" type="button" onClick={upgradeGuestAccount}>
            <Plus size={18} />
            {text("account.guestUpgrade", "Create an account")}
          </button>
        )}
      </section>

      {isGuest && (
        <div className="customerAccountGuestBanner">
          <ShieldCheck size={19} />
          <span>{text("account.guestHint", "Create an account to keep your details across devices.")}</span>
        </div>
      )}

      <div className="customerAccountGrid">
        <aside className="customerAccountSidebar">
          <nav aria-label={text("account.menuLabel", "Account menu")}>
            {menuItems.map(({ to, end, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                <Icon size={18} />
                <span>{label}</span>
                <ArrowRight size={15} />
              </NavLink>
            ))}
          </nav>

          <button type="button" className="customerAccountSignOut" onClick={handleSignOut}>
            <LogOut size={18} />
            {text("account.signOut", "Sign out")}
          </button>
        </aside>

        <section className="customerAccountContent">
          {section === "overview" && (
            <>
              <div className="customerAccountSectionHeading">
                <div>
                  <span>{text("account.accountHome", "My account")}</span>
                  <h2>{text("account.overviewTitle", "Welcome back")}</h2>
                  <p>{text("account.overviewText", "Manage your orders, saved products and delivery information in one place.")}</p>
                </div>
              </div>

              <div className="customerAccountStats">
                <Link to="/account/orders">
                  <Package size={22} />
                  <strong>{orders.length}</strong>
                  <span>{text("account.orders", "My orders")}</span>
                </Link>
                <Link to="/account/favorites">
                  <Heart size={22} />
                  <strong>{favoriteProducts.length}</strong>
                  <span>{text("account.favorites", "Favorites")}</span>
                </Link>
                <Link to="/account/addresses">
                  <MapPin size={22} />
                  <strong>{addresses.length}</strong>
                  <span>{text("account.addresses", "Addresses")}</span>
                </Link>
              </div>

              <div className="customerAccountPanel">
                <div className="customerAccountPanelHeader">
                  <h3>{text("account.recentOrders", "Recent orders")}</h3>
                  <Link to="/account/orders">
                    {text("account.viewAll", "View all")}
                    <ArrowRight size={16} />
                  </Link>
                </div>
                {renderOrders(recentOrders)}
              </div>
            </>
          )}

          {section === "orders" && (
            <>
              <div className="customerAccountSectionHeading">
                <div>
                  <span>{text("account.accountHome", "My account")}</span>
                  <h2>{text("account.orders", "My orders")}</h2>
                  <p>{text("account.deviceOrdersNote", "Orders currently shown are saved on this device.")}</p>
                </div>
              </div>
              {renderOrders(orders)}
            </>
          )}

          {section === "favorites" && (
            <>
              <div className="customerAccountSectionHeading">
                <div>
                  <span>{text("account.favorites", "Favorites")}</span>
                  <h2>{text("account.favoritesTitle", "Favorite products")}</h2>
                  <p>{text("account.favoritesText", "Products you save will stay ready here.")}</p>
                </div>
              </div>

              {favoriteProducts.length > 0 ? (
                <div className="customerFavoriteGrid">
                  {favoriteProducts.map((product) => (
                    <ProductCard key={product.key} product={product} />
                  ))}
                </div>
              ) : (
                <div className="customerAccountEmpty">
                  <Heart size={32} />
                  <h3>{text("account.noFavorites", "You have not saved any products yet.")}</h3>
                  <Link to="/products">{text("account.shopNow", "Start shopping")}</Link>
                </div>
              )}
            </>
          )}

          {section === "profile" && (
            <>
              <div className="customerAccountSectionHeading">
                <div>
                  <span>{text("account.profile", "Profile details")}</span>
                  <h2>{text("account.profileTitle", "Profile details")}</h2>
                  <p>{text("account.profileText", "Keep your contact information ready for faster checkout.")}</p>
                </div>
              </div>

              <form className="customerAccountForm" onSubmit={handleProfileSubmit}>
                <label>
                  <span>{text("account.fullName", "Full name")}</span>
                  <input
                    value={profileForm.fullName}
                    onChange={(event) => setProfileForm((previous) => ({ ...previous, fullName: event.target.value }))}
                  />
                </label>
                <label>
                  <span>{text("account.email", "Email")}</span>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(event) => setProfileForm((previous) => ({ ...previous, email: event.target.value }))}
                  />
                </label>
                <label>
                  <span>{text("account.phone", "Phone")}</span>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(event) => setProfileForm((previous) => ({ ...previous, phone: event.target.value }))}
                  />
                </label>
                <button type="submit">
                  {profileSaved ? text("account.saved", "Saved") : text("account.saveProfile", "Save profile")}
                </button>
              </form>
            </>
          )}

          {section === "addresses" && (
            <>
              <div className="customerAccountSectionHeading">
                <div>
                  <span>{text("account.addresses", "Addresses")}</span>
                  <h2>{text("account.addressesTitle", "Delivery addresses")}</h2>
                  <p>{text("account.addressesText", "Save the addresses you use most often.")}</p>
                </div>
              </div>

              <form className="customerAddressForm" onSubmit={handleAddressSubmit}>
                <input
                  placeholder={text("account.addressLabelPlaceholder", "Home, Work...")}
                  value={addressForm.label}
                  onChange={(event) => setAddressForm((previous) => ({ ...previous, label: event.target.value }))}
                />
                <input
                  placeholder={text("account.fullName", "Full name")}
                  value={addressForm.fullName}
                  onChange={(event) => setAddressForm((previous) => ({ ...previous, fullName: event.target.value }))}
                />
                <input
                  placeholder={text("account.phone", "Phone")}
                  value={addressForm.phone}
                  onChange={(event) => setAddressForm((previous) => ({ ...previous, phone: event.target.value }))}
                />
                <input
                  required
                  placeholder={text("account.city", "City")}
                  value={addressForm.city}
                  onChange={(event) => setAddressForm((previous) => ({ ...previous, city: event.target.value }))}
                />
                <input
                  placeholder={text("account.country", "Country")}
                  value={addressForm.country}
                  onChange={(event) => setAddressForm((previous) => ({ ...previous, country: event.target.value }))}
                />
                <textarea
                  required
                  rows="3"
                  placeholder={text("account.fullAddress", "Full address")}
                  value={addressForm.address}
                  onChange={(event) => setAddressForm((previous) => ({ ...previous, address: event.target.value }))}
                />
                <button type="submit">
                  <Plus size={18} />
                  {text("account.addAddress", "Add address")}
                </button>
              </form>

              {addresses.length > 0 ? (
                <div className="customerAddressList">
                  {addresses.map((item) => (
                    <article key={item.id} className={item.isDefault ? "default" : ""}>
                      <div className="customerAddressIcon">
                        <MapPin size={20} />
                      </div>
                      <div className="customerAddressCopy">
                        <div>
                          <strong>{item.label}</strong>
                          {item.isDefault && <span>{text("account.defaultAddress", "Default")}</span>}
                        </div>
                        <p>{item.fullName} {item.phone ? `· ${item.phone}` : ""}</p>
                        <small>{item.address}, {item.city}{item.country ? `, ${item.country}` : ""}</small>
                      </div>
                      <div className="customerAddressActions">
                        {!item.isDefault && (
                          <button type="button" onClick={() => setDefaultAddress(item.id)}>
                            {text("account.makeDefault", "Make default")}
                          </button>
                        )}
                        <button type="button" className="remove" onClick={() => removeAddress(item.id)}>
                          <Trash2 size={16} />
                          {text("account.remove", "Remove")}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="customerAccountEmpty compact">
                  <MapPin size={30} />
                  <h3>{text("account.noAddresses", "No saved addresses yet.")}</h3>
                </div>
              )}
            </>
          )}

          {section === "security" && (
            <>
              <div className="customerAccountSectionHeading">
                <div>
                  <span>{text("account.security", "Account & security")}</span>
                  <h2>{text("account.securityTitle", "Account & security")}</h2>
                  <p>{text("account.securityText", "Review your sign-in method and connected account.")}</p>
                </div>
              </div>

              <div className="customerSecurityCard">
                <div>
                  <span>{text("account.signInMethod", "Sign-in method")}</span>
                  <strong>{isGuest ? text("account.guestSession", "Guest session") : text(`auth.method.${authType}`, authType)}</strong>
                </div>
                <div>
                  <span>{text("account.connectedAccount", "Connected account")}</span>
                  <strong>{profileEmail || address || text("account.guestSecurityText", "This session is stored only on this device.")}</strong>
                </div>

                {isGuest ? (
                  <button type="button" onClick={upgradeGuestAccount}>
                    <Plus size={18} />
                    {text("account.guestUpgrade", "Create an account")}
                  </button>
                ) : (
                  <button type="button" onClick={manageWallet}>
                    <ShieldCheck size={18} />
                    {text("account.manageAccount", "Manage connected account")}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default CustomerAccount;
