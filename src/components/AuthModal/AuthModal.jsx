import { useEffect } from "react";
import {
  CheckCircle2,
  LogOut,
  Settings2,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { FaFacebookF } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { useLanguage } from "../../i18n/LanguageContext";

import "./AuthModal.css";

function shortenAddress(address) {
  if (!address) {
    return "";
  }

  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function AuthModal() {
  const { t } = useLanguage();
  const {
    address,
    authType,
    busyAction,
    closeAuthModal,
    continueAsGuest,
    displayName,
    errorCode,
    isAuthModalOpen,
    isAuthenticated,
    isConnected,
    isGuest,
    manageWallet,
    profileEmail,
    signOut,
    startSocialLogin,
    startWalletLogin,
    upgradeGuestAccount,
  } = useCustomerAuth();

  useEffect(() => {
    if (!isAuthModalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeAuthModal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeAuthModal, isAuthModalOpen]);

  if (!isAuthModalOpen) {
    return null;
  }

  const methodLabel = authType ? t(`auth.method.${authType}`) : "";
  const visibleName = isGuest ? t("auth.method.guest") : displayName;

  return (
    <div
      className="customerAuthOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeAuthModal();
        }
      }}
    >
      <section
        className="customerAuthModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-auth-title"
      >
        <button
          type="button"
          className="customerAuthClose"
          onClick={closeAuthModal}
          aria-label={t("auth.close")}
        >
          <X size={19} />
        </button>

        {!isAuthenticated ? (
          <>
            <div className="customerAuthHeading">
              <span className="customerAuthEyebrow">
                <ShieldCheck size={15} />
                {t("auth.modalEyebrow")}
              </span>

              <h2 id="customer-auth-title">{t("auth.modalTitle")}</h2>
              <p>{t("auth.modalText")}</p>
            </div>

            <div className="customerAuthOptions">
              <button
                type="button"
                className="customerAuthOption customerAuthOption--google"
                onClick={() => startSocialLogin("google")}
                disabled={Boolean(busyAction)}
              >
                <span className="customerAuthOptionIcon">
                  <FcGoogle size={23} />
                </span>
                <span>{t("auth.continueGoogle")}</span>
              </button>

              <button
                type="button"
                className="customerAuthOption customerAuthOption--facebook"
                onClick={() => startSocialLogin("facebook")}
                disabled={Boolean(busyAction)}
              >
                <span className="customerAuthOptionIcon customerAuthOptionIcon--facebook">
                  <FaFacebookF size={18} />
                </span>
                <span>{t("auth.continueFacebook")}</span>
              </button>

              <button
                type="button"
                className="customerAuthOption customerAuthOption--wallet"
                onClick={startWalletLogin}
                disabled={Boolean(busyAction)}
              >
                <span className="customerAuthOptionIcon customerAuthOptionIcon--wallet">
                  <WalletCards size={21} />
                </span>
                <span>{t("auth.continueWallet")}</span>
              </button>
            </div>

            <div className="customerAuthDivider">
              <span>{t("auth.or")}</span>
            </div>

            <button
              type="button"
              className="customerAuthGuestButton"
              onClick={continueAsGuest}
              disabled={Boolean(busyAction)}
            >
              <UserRound size={19} />
              <span>{t("auth.continueGuest")}</span>
            </button>

            {errorCode && (
              <p className="customerAuthError" role="alert">
                {t(`auth.${errorCode}`)}
              </p>
            )}

            <div className="customerAuthTrust">
              <ShieldCheck size={16} />
              <div>
                <strong>{t("auth.secureTitle")}</strong>
                <span>{t("auth.secureNote")}</span>
              </div>
            </div>

            <p className="customerAuthGuestNote">{t("auth.guestNote")}</p>
          </>
        ) : (
          <>
            <div className="customerAuthProfileIcon" aria-hidden="true">
              {isGuest ? <UserRound size={30} /> : <CheckCircle2 size={31} />}
            </div>

            <div className="customerAuthHeading customerAuthHeading--profile">
              <span className="customerAuthEyebrow">{methodLabel}</span>
              <h2 id="customer-auth-title">
                {isGuest ? t("auth.guestTitle") : t("auth.signedInTitle")}
              </h2>
              <p>
                {isGuest ? t("auth.guestText") : t("auth.signedInText")}
              </p>
            </div>

            <div className="customerAuthProfileCard">
              <div className="customerAuthAvatar">
                <UserRound size={22} />
              </div>

              <div className="customerAuthProfileCopy">
                <strong>{visibleName}</strong>
                {profileEmail && <span>{profileEmail}</span>}
                {isConnected && address && (
                  <span>
                    {t("auth.connectedAddress")}: {shortenAddress(address)}
                  </span>
                )}
              </div>
            </div>

            {errorCode && (
              <p className="customerAuthError" role="alert">
                {t(`auth.${errorCode}`)}
              </p>
            )}

            <div className="customerAuthProfileActions">
              {isGuest ? (
                <button
                  type="button"
                  className="customerAuthPrimaryAction"
                  onClick={upgradeGuestAccount}
                >
                  <UserRound size={18} />
                  {t("auth.upgradeGuest")}
                </button>
              ) : (
                <button
                  type="button"
                  className="customerAuthPrimaryAction"
                  onClick={manageWallet}
                >
                  <Settings2 size={18} />
                  {t("auth.manageWallet")}
                </button>
              )}

              <button
                type="button"
                className="customerAuthSecondaryAction"
                onClick={signOut}
                disabled={Boolean(busyAction)}
              >
                <LogOut size={18} />
                {t("auth.signOut")}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default AuthModal;
