import { Link, NavLink } from "react-router-dom";
import {
  ArrowRight,
  ShoppingBag,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";

import { useLanguage } from "../../i18n/LanguageContext";
import { useCart } from "../../context/CartContext";
import LanguageSwitcher from "../LanguageSwitcher";
import siteConfig from "../../config/site";

import "./Header.css";

function shortenAddress(address) {
  if (!address) {
    return "";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function Header() {
  const { t } = useLanguage();
  const { cartCount } = useCart();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  const handleWalletClick = () => {
    open({
      view: isConnected ? "Account" : "Connect",
    });
  };

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
            <span className="logoMark">K</span>
            <span className="logoText">{siteConfig.brandName}</span>
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
            <button
              type="button"
              className="walletConnectButton"
              onClick={handleWalletClick}
            >
              <WalletCards size={17} />

              <span>
                {isConnected
                  ? shortenAddress(address)
                  : t("header.connectWallet")}
              </span>
            </button>

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