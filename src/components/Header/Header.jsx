import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ChevronDown,
  LogOut,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { FaFacebookF } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

import { useLanguage } from "../../i18n/LanguageContext";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import CustomerAvatar from "../CustomerAvatar/CustomerAvatar";
import LanguageSwitcher from "../LanguageSwitcher";
import RotavoyLogo from "../Brand/RotavoyLogo";
import siteConfig from "../../config/site";

import "./Header.css";
import "./AuthHeader.css";
import "./LoginPreview.css";

function Header() {
  const location = useLocation();
  const accountControlRef = useRef(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const { t } = useLanguage();
  const {
    address,
    authType,
    busyAction,
    continueAsGuest,
    displayName,
    isAuthenticated,
    isGuest,
    openAuthModal,
    profileEmail,
    providerAvailability,
    signOut,
    startSocialLogin,
    startWalletLogin,
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

  const isLoginBusy = Boolean(busyAction);

  useEffect(() => {
    setIsAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isAccountMenuOpen) return undefined;

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
      <div className="mainHeader">
        <div className="siteHeader">
          <Link
            to="/"
            className="logo"
            aria-label={`${siteConfig.brandName} Travel home`}
          >
            <RotavoyLogo
              className="headerRotavoyLogo"
              alt={`${siteConfig.brandName} Travel`}
            />
          </Link>

          <nav className="navLinks" aria-label="Travel navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `travelNavLink${isActive ? " active" : ""}`
              }
            >
              {text("nav.travel", "Travel")}
            </NavLink>

            <NavLink
              to="/about"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              About
            </NavLink>

            <NavLink
              to="/support"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Support
            </NavLink>
          </nav>

          <div className="headerActions">
            <LanguageSwitcher />

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

              {!isAuthenticated && (
                <div
                  className="customerLoginPreview"
                  role="menu"
                  aria-label={accountLabel}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => startSocialLogin("google")}
                    disabled={isLoginBusy || providerAvailability?.google === false}
                  >
                    <span className="customerLoginPreviewIcon">
                      <FcGoogle size={20} />
                    </span>
                    {t("auth.continueGoogle")}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => startSocialLogin("facebook")}
                    disabled={isLoginBusy || providerAvailability?.facebook === false}
                  >
                    <span className="customerLoginPreviewIcon customerLoginPreviewIcon--facebook">
                      <FaFacebookF size={15} />
                    </span>
                    {t("auth.continueFacebook")}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={startWalletLogin}
                    disabled={isLoginBusy}
                  >
                    <span className="customerLoginPreviewIcon customerLoginPreviewIcon--wallet">
                      <WalletCards size={17} />
                    </span>
                    {t("auth.continueWallet")}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={continueAsGuest}
                    disabled={isLoginBusy}
                  >
                    <span className="customerLoginPreviewIcon customerLoginPreviewIcon--guest">
                      <UserRound size={17} />
                    </span>
                    {t("auth.continueGuest")}
                  </button>
                </div>
              )}

              {isAuthenticated && isAccountMenuOpen && (
                <div className="customerAccountDropdown" role="menu">
                  <div className="customerAccountDropdownProfile">
                    <CustomerAvatar size="medium" />
                    <span>
                      <strong>{displayName || accountLabel}</strong>
                      <small>
                        {profileEmail ||
                          address ||
                          text(`auth.method.${authType}`, "Travel account")}
                      </small>
                    </span>
                  </div>

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
                        <strong>Create an account</strong>
                        <small>Keep your travel access across devices.</small>
                      </span>
                    </button>
                  )}

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
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
