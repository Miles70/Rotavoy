import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Heart,
  LogOut,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
} from "lucide-react";

import { useLanguage } from "../../i18n/LanguageContext";
import { useCart } from "../../context/CartContext";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import CustomerAvatar from "../CustomerAvatar/CustomerAvatar";
import LanguageSwitcher from "../LanguageSwitcher";
import siteConfig from "../../config/site";

import "./Header.css";
import "./AuthHeader.css";
import "./Logo.css";

function Header() {
  const location = useLocation();
  const accountControlRef = useRef(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const { t } = useLanguage();
  const { cartCount } = useCart();
  const {
    address,
    authType,
    displayName,
    isAuthenticated,
    isGuest,
    openAuthModal,
    profileEmail,
    signOut,
    upgradeGuestAccount,
  } = useCustomerAuth();

  const text = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  const accountLabel = !isAuthenticated
    ? text("auth.headerSignIn", "Sign in")
    : isGuest
      ? text("auth.headerGuest", "Guest")
      : displayName;

  useEffect(() => {
    setIsAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!accountControlRef.current?.contains(event.target)) {
        setIsAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  function handleAccountButton() {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    setIsAccountMenuOpen((previous) => !previous);
  }

  async function handleSignOut() {
    setIsAccountMenuOpen(false);
    await signOut();
  }

  return (
    <header className="headerWrapper">
      <div className="promoBar">
        <div className="promoBarContent">
          <span className="promoBadge">
            <Sparkles size={13} />
            {t("deals.tag")}
          </span>

          <span className="promoText">{t("deals.text")}</span>

          <Link className="promoLink" to="/products">
            {t("deals.button")}
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <div className="mainHeader">
        <div className="siteHeader">
          <Link
            to="/"
            className="logo"
            aria-label={`${siteConfig.brandName} home`}
          >
            <span className="logoMark" aria-hidden="true">
              <svg className="logoGlyph" viewBox="0 0 48 48">
                <path
                  className="logoGlyphStroke"
                  d="M34 15.5C31.2 12.6 27.9 11 23.6 11C16 11 10.5 16.4 10.5 24S16 37 23.6 37C27.9 37 31.5 35.5 34.4 32.8V25H24"
                />
                <circle className="logoGlyphDot" cx="34.4" cy="25" r="2.3" />
              </svg>
              <span className="logoSpark" />
            </span>

            <span className="logoText" aria-hidden="true">
              <span className="logoTextCore">Gaba</span>
              <span className="logoTextAccent">loo</span>
            </span>
          </Link>

          <nav className="navLinks" aria-label="Main navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {t("nav.home")}
            </NavLink>

            <NavLink
              to="/categories"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {t("nav.categories")}
            </NavLink>

            <NavLink
              to="/products"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {t("nav.products")}
            </NavLink>

            <NavLink
              to="/cart"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {t("nav.cart")}
            </NavLink>
          </nav>

          <div className="headerActions">
            <div className="customerAccountControl" ref={accountControlRef}>
              <button
                type="button"
                className={`customerHeaderAuthButton${
                  isAuthenticated ? " customerHeaderAuthButton--active" : ""
                }${isGuest ? " customerHeaderAuthButton--guest" : ""}`}
                onClick={handleAccountButton}
                aria-label={accountLabel}
                aria-expanded={isAuthenticated ? isAccountMenuOpen : undefined}
                aria-haspopup={isAuthenticated ? "menu" : undefined}
                title={accountLabel}
              >
                {isAuthenticated ? (
                  <CustomerAvatar size="small" />
                ) : (
                  <span className="customerHeaderAuthIcon" aria-hidden="true">
                    <UserRound size={17} />
                  </span>
                )}

                <span className="customerHeaderAuthText">{accountLabel}</span>

                {isAuthenticated && (
                  <ChevronDown
                    className={`customerHeaderAuthChevron${
                      isAccountMenuOpen ? " open" : ""
                    }`}
                    size={15}
                    aria-hidden="true"
                  />
                )}
              </button>

              {isAuthenticated && isAccountMenuOpen && (
                <div className="customerAccountDropdown" role="menu">
                  <Link className="customerAccountDropdownProfile" to="/account">
                    <CustomerAvatar size="medium" />
                    <span>
                      <strong>{displayName || accountLabel}</strong>
                      <small>
                        {profileEmail ||
                          address ||
                          text(`auth.method.${authType}`, "Account")}
                      </small>
                    </span>
                  </Link>

                  {isGuest && (
                    <button
                      type="button"
                      className="customerAccountDropdownUpgrade"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        upgradeGuestAccount();
                      }}
                    >
                      <ShieldCheck size={17} />
                      <span>
                        <strong>{text("account.guestUpgrade", "Create an account")}</strong>
                        <small>{text("account.guestHint", "Keep your details across devices.")}</small>
                      </span>
                    </button>
                  )}

                  <nav aria-label={text("account.menuLabel", "Account menu")}>
                    <Link to="/account/orders" role="menuitem">
                      <Package size={18} />
                      {text("account.orders", "My orders")}
                    </Link>
                    <Link to="/account/favorites" role="menuitem">
                      <Heart size={18} />
                      {text("account.favorites", "Favorites")}
                    </Link>
                    <Link to="/account/addresses" role="menuitem">
                      <MapPin size={18} />
                      {text("account.addresses", "Addresses")}
                    </Link>
                    <Link to="/account/profile" role="menuitem">
                      <UserRound size={18} />
                      {text("account.profile", "Profile details")}
                    </Link>
                    <Link to="/account/security" role="menuitem">
                      <ShieldCheck size={18} />
                      {text("account.security", "Account & security")}
                    </Link>
                  </nav>

                  <button
                    type="button"
                    className="customerAccountDropdownSignOut"
                    onClick={handleSignOut}
                    role="menuitem"
                  >
                    <LogOut size={18} />
                    {text("account.signOut", "Sign out")}
                  </button>
                </div>
              )}
            </div>

            <Link
              to="/cart"
              className="cartButton"
              aria-label={t("header.cart")}
            >
              <ShoppingBag size={18} />

              <span className="cartButtonText">{t("header.cart")}</span>

              {cartCount > 0 && (
                <strong className="cartCount">{cartCount}</strong>
              )}
            </Link>

            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
