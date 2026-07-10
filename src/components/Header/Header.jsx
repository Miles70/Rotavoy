import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
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
      <div className="siteHeader">
        <Link to="/" className="logo">
          {siteConfig.brandName}
        </Link>

        <nav className="navLinks">
          <Link to="/">{t("nav.home")}</Link>
          <Link to="/categories">{t("nav.categories")}</Link>
          <Link to="/products">{t("nav.products")}</Link>
          <Link to="/cart">{t("nav.cart")}</Link>
        </nav>

        <div className="headerActions">
          <button
            type="button"
            className="walletConnectButton"
            onClick={handleWalletClick}
          >
            {isConnected ? shortenAddress(address) : t("header.connectWallet")}
          </button>

          <Link to="/cart" className="cartButton">
            <ShoppingBag size={18} />
            <span>{t("header.cart")}</span>

            {cartCount > 0 && (
              <strong className="cartCount">{cartCount}</strong>
            )}
          </Link>

          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

export default Header;