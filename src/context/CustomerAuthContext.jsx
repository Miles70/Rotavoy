import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  useAppKitAccount,
  useDisconnect,
} from "@reown/appkit/react";
import { ChainController } from "@reown/appkit-controllers";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";

import { appKit } from "../config/wagmi";
import {
  appleAuthProvider,
  facebookAuthProvider,
  firebaseAuth,
  firebaseProviderAvailability,
  googleAuthProvider,
} from "../config/firebase";

const CustomerAuthContext = createContext(null);
const GUEST_STORAGE_KEY = "gabaloo_guest_session";

const FIREBASE_PROVIDERS = {
  google: googleAuthProvider,
  facebook: facebookAuthProvider,
  apple: appleAuthProvider,
};

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

function getFirebaseAuthType(user) {
  const providerId = user?.providerData?.find((item) => item?.providerId)?.providerId;

  switch (providerId) {
    case "google.com":
      return "google";
    case "facebook.com":
      return "facebook";
    case "apple.com":
      return "apple";
    default:
      return "email";
  }
}

function mapFirebaseError(error) {
  switch (error?.code) {
    case "auth/popup-closed-by-user":
      return "popupClosed";
    case "auth/popup-blocked":
      return "popupBlocked";
    case "auth/operation-not-allowed":
      return "socialUnavailable";
    case "auth/unauthorized-domain":
      return "unauthorizedDomain";
    case "auth/account-exists-with-different-credential":
      return "accountExists";
    case "auth/cancelled-popup-request":
      return "";
    default:
      return "genericError";
  }
}

export function CustomerAuthProvider({ children }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [guestSession, setGuestSession] = useState(readGuestSession);
  const [busyAction, setBusyAction] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [reownProfile, setReownProfile] = useState({
    name: "",
    image: "",
  });

  const {
    address,
    isConnected: isWalletConnected,
  } = useAppKitAccount();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setFirebaseUser(nextUser);
      setIsFirebaseReady(true);

      if (!nextUser) {
        return;
      }

      localStorage.removeItem(GUEST_STORAGE_KEY);
      setGuestSession(null);
      setBusyAction("");
      setErrorCode("");
      setIsAuthModalOpen(false);
    });
  }, []);

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
    if (!isWalletConnected) {
      return;
    }

    localStorage.removeItem(GUEST_STORAGE_KEY);
    setGuestSession(null);
    setBusyAction("");
    setErrorCode("");
    setIsAuthModalOpen(false);
  }, [isWalletConnected]);

  const firebaseAuthType = getFirebaseAuthType(firebaseUser);
  const authType = firebaseUser
    ? firebaseAuthType
    : isWalletConnected
      ? "wallet"
      : guestSession
        ? "guest"
        : null;

  const profileEmail = firebaseUser?.email || "";
  const profileImage = firebaseUser?.photoURL || reownProfile.image || "";

  const displayName = firebaseUser
    ? firebaseUser.displayName ||
      profileEmail.split("@")[0] ||
      "Gabaloo"
    : isWalletConnected
      ? reownProfile.name || shortenAddress(address) || "Gabaloo"
      : guestSession
        ? "Guest"
        : "";

  const accountKey = firebaseUser
    ? `firebase:${firebaseUser.uid}`
    : isWalletConnected
      ? `wallet:${address || displayName}`
      : guestSession
        ? `guest:${guestSession.id}`
        : "";

  const isAuthenticated = Boolean(
    firebaseUser || isWalletConnected || guestSession,
  );

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

    const firebaseProvider = FIREBASE_PROVIDERS[provider];

    if (!firebaseProvider || !firebaseProviderAvailability[provider]) {
      setErrorCode("socialUnavailable");
      return;
    }

    setBusyAction(provider);
    setErrorCode("");

    try {
      await signInWithPopup(firebaseAuth, firebaseProvider);
      setIsAuthModalOpen(false);
    } catch (error) {
      const nextErrorCode = mapFirebaseError(error);

      if (nextErrorCode) {
        setErrorCode(nextErrorCode);
        setIsAuthModalOpen(true);
      }
    } finally {
      setBusyAction("");
    }
  }

  async function startWalletLogin() {
    if (busyAction) {
      return;
    }

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
    if (!isWalletConnected) {
      return;
    }

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

    setBusyAction("signOut");
    setErrorCode("");

    try {
      if (firebaseUser) {
        await firebaseSignOut(firebaseAuth);
      }

      if (isWalletConnected) {
        await disconnect();
      }

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
    firebaseUser,
    initials: createInitials(displayName || profileEmail || address),
    isAuthModalOpen,
    isAuthenticated,
    isConnected: isWalletConnected,
    isFirebaseAuthenticated: Boolean(firebaseUser),
    isFirebaseReady,
    isGuest: Boolean(guestSession) && !firebaseUser && !isWalletConnected,
    manageWallet,
    openAuthModal,
    profileEmail,
    profileImage,
    providerAvailability: firebaseProviderAvailability,
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
