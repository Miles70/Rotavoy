import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useAppKitAccount,
  useDisconnect,
} from "@reown/appkit/react";
import { ChainController } from "@reown/appkit-controllers";
import { executeSocialLogin } from "@reown/appkit-controllers/utils";

import { appKit } from "../config/wagmi";

const CustomerAuthContext = createContext(null);
const GUEST_STORAGE_KEY = "gabaloo_guest_session";
const SOCIAL_AUTH_CLASS = "gabalooSocialAuthActive";
const SUPPORTED_SOCIAL_PROVIDERS = new Set([
  "google",
  "apple",
  "facebook",
]);

function createGuestId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readGuestSession() {
  try {
    const storedSession = localStorage.getItem(GUEST_STORAGE_KEY);

    if (!storedSession) {
      return null;
    }

    const parsedSession = JSON.parse(storedSession);

    if (!parsedSession?.id) {
      localStorage.removeItem(GUEST_STORAGE_KEY);
      return null;
    }

    return parsedSession;
  } catch {
    localStorage.removeItem(GUEST_STORAGE_KEY);
    return null;
  }
}

function shortenAddress(address) {
  if (!address) {
    return "";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function createInitials(value) {
  const normalized = String(value || "")
    .replace(/@.*/, "")
    .trim();

  if (!normalized) {
    return "G";
  }

  const parts = normalized.split(/\s+/).filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function hasConnectedReownAccount() {
  const accountData = ChainController.getAccountData();

  return Boolean(
    accountData?.address ||
      accountData?.caipAddress ||
      accountData?.status === "connected",
  );
}

export function CustomerAuthProvider({ children }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [guestSession, setGuestSession] = useState(readGuestSession);
  const [busyAction, setBusyAction] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [reownProfile, setReownProfile] = useState({
    name: "",
    image: "",
  });

  const socialPollRef = useRef(null);
  const socialGraceRef = useRef(null);
  const isConnectedRef = useRef(false);

  const { address, embeddedWalletInfo, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();

  isConnectedRef.current = isConnected;

  function clearSocialWatchers() {
    if (socialPollRef.current) {
      window.clearInterval(socialPollRef.current);
      socialPollRef.current = null;
    }

    if (socialGraceRef.current) {
      window.clearTimeout(socialGraceRef.current);
      socialGraceRef.current = null;
    }
  }

  function hideReownDuringSocialAuth() {
    document.documentElement.classList.add(SOCIAL_AUTH_CLASS);
  }

  function restoreReownVisibility() {
    document.documentElement.classList.remove(SOCIAL_AUTH_CLASS);
  }

  function closeReownModal() {
    Promise.resolve(appKit.close()).catch(() => undefined);
  }

  function finishSocialAttempt({ reopenAuth = false, error = "" } = {}) {
    clearSocialWatchers();
    restoreReownVisibility();
    closeReownModal();
    setBusyAction("");

    if (reopenAuth && !isConnectedRef.current && !hasConnectedReownAccount()) {
      setErrorCode(error || "genericError");
      setIsAuthModalOpen(true);
    }
  }

  useEffect(() => {
    function syncReownProfile() {
      const accountData = ChainController.getAccountData();

      setReownProfile({
        name: accountData?.profileName || "",
        image: accountData?.profileImage || "",
      });
    }

    syncReownProfile();
    const unsubscribe = ChainController.subscribe(syncReownProfile);

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    return () => {
      clearSocialWatchers();
      restoreReownVisibility();
    };
  }, []);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    clearSocialWatchers();
    restoreReownVisibility();
    closeReownModal();
    setBusyAction("");

    if (guestSession) {
      localStorage.removeItem(GUEST_STORAGE_KEY);
      setGuestSession(null);
    }

    setErrorCode("");
    setIsAuthModalOpen(false);
  }, [guestSession, isConnected]);

  const socialUser = embeddedWalletInfo?.user;
  const authType = isConnected
    ? embeddedWalletInfo?.authProvider || "wallet"
    : guestSession
      ? "guest"
      : null;

  const profileEmail = socialUser?.email || "";
  const profileImage =
    reownProfile.image ||
    socialUser?.profileImage ||
    socialUser?.avatar ||
    socialUser?.picture ||
    socialUser?.image ||
    "";

  const displayName = isConnected
    ? reownProfile.name ||
      socialUser?.name ||
      socialUser?.username ||
      profileEmail?.split("@")[0] ||
      shortenAddress(address) ||
      "Gabaloo"
    : guestSession
      ? "Guest"
      : "";

  const accountKey = isConnected
    ? `${authType}:${address || profileEmail || displayName}`
    : guestSession
      ? `guest:${guestSession.id}`
      : "";

  function openAuthModal() {
    setErrorCode("");
    setIsAuthModalOpen(true);
  }

  function closeAuthModal() {
    if (busyAction) {
      return;
    }

    setErrorCode("");
    setIsAuthModalOpen(false);
  }

  async function startSocialLogin(provider) {
    if (busyAction) {
      return;
    }

    if (!SUPPORTED_SOCIAL_PROVIDERS.has(provider)) {
      setErrorCode("socialUnavailable");
      return;
    }

    clearSocialWatchers();
    setBusyAction(provider);
    setErrorCode("");
    setIsAuthModalOpen(false);
    hideReownDuringSocialAuth();

    try {
      await appKit.open({ view: "Connect", namespace: "eip155" });
      await executeSocialLogin(provider);

      const startedAt = Date.now();

      socialPollRef.current = window.setInterval(() => {
        const accountData = ChainController.getAccountData();
        const popupWindow = accountData?.socialWindow;
        const connected =
          isConnectedRef.current ||
          Boolean(accountData?.address) ||
          Boolean(accountData?.caipAddress) ||
          accountData?.status === "connected";

        if (connected) {
          finishSocialAttempt();
          return;
        }

        if (popupWindow?.closed) {
          window.clearInterval(socialPollRef.current);
          socialPollRef.current = null;

          socialGraceRef.current = window.setTimeout(() => {
            if (isConnectedRef.current || hasConnectedReownAccount()) {
              finishSocialAttempt();
            } else {
              finishSocialAttempt({
                reopenAuth: true,
                error: "genericError",
              });
            }
          }, 900);

          return;
        }

        if (!popupWindow && Date.now() - startedAt > 10000) {
          finishSocialAttempt({
            reopenAuth: true,
            error: "genericError",
          });
          return;
        }

        if (Date.now() - startedAt > 120000) {
          try {
            popupWindow?.close();
          } catch {
            // Ignore cross-origin popup cleanup errors.
          }

          finishSocialAttempt({
            reopenAuth: true,
            error: "genericError",
          });
        }
      }, 350);
    } catch {
      finishSocialAttempt({
        reopenAuth: true,
        error: "genericError",
      });
    }
  }

  async function startWalletLogin() {
    if (busyAction) {
      return;
    }

    clearSocialWatchers();
    restoreReownVisibility();
    setBusyAction("wallet");
    setErrorCode("");
    setIsAuthModalOpen(false);

    try {
      await appKit.open({ view: "Connect" });
    } catch {
      setErrorCode("genericError");
      setIsAuthModalOpen(true);
    } finally {
      setBusyAction("");
    }
  }

  function continueAsGuest() {
    clearSocialWatchers();
    restoreReownVisibility();
    closeReownModal();

    const nextGuestSession = {
      id: createGuestId(),
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(nextGuestSession));
    setGuestSession(nextGuestSession);
    setErrorCode("");
    setIsAuthModalOpen(false);
  }

  function upgradeGuestAccount() {
    localStorage.removeItem(GUEST_STORAGE_KEY);
    setGuestSession(null);
    setErrorCode("");
    setIsAuthModalOpen(true);
  }

  async function manageWallet() {
    clearSocialWatchers();
    restoreReownVisibility();
    setErrorCode("");
    setIsAuthModalOpen(false);

    try {
      await appKit.open({ view: "Account" });
    } catch {
      setErrorCode("genericError");
      setIsAuthModalOpen(true);
    }
  }

  async function signOut() {
    if (busyAction) {
      return;
    }

    clearSocialWatchers();
    restoreReownVisibility();
    setBusyAction("signOut");
    setErrorCode("");

    try {
      if (isConnected) {
        await disconnect();
      }

      closeReownModal();
      localStorage.removeItem(GUEST_STORAGE_KEY);
      setGuestSession(null);
      setIsAuthModalOpen(false);
    } catch {
      setErrorCode("genericError");
    } finally {
      setBusyAction("");
    }
  }

  const value = {
    accountKey,
    address,
    authType,
    busyAction,
    closeAuthModal,
    continueAsGuest,
    displayName,
    errorCode,
    initials: createInitials(displayName || profileEmail || address),
    isAuthModalOpen,
    isAuthenticated: isConnected || Boolean(guestSession),
    isConnected,
    isGuest: Boolean(guestSession) && !isConnected,
    manageWallet,
    openAuthModal,
    profileEmail,
    profileImage,
    signOut,
    startSocialLogin,
    startWalletLogin,
    upgradeGuestAccount,
  };

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);

  if (!context) {
    throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
  }

  return context;
}
