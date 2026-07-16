import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAppKitAccount, useDisconnect } from "@reown/appkit/react";
import { ChainController } from "@reown/appkit-controllers";
import { useSignMessage } from "wagmi";
import {
  FacebookAuthProvider,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";

import { appKit } from "../config/wagmi";
import {
  facebookAuthProvider,
  firebaseAuth,
  firebaseProviderAvailability,
  googleAuthProvider,
} from "../config/firebase";
import {
  clearStoredCustomerSession,
  createFirebaseCustomerSession,
  createGuestCustomerSession,
  createWalletChallenge,
  createWalletCustomerSession,
  getStoredCustomerSession,
  logoutCustomerSession,
  storeCustomerSession,
  validateCustomerSession,
} from "../services/customerApi";

const CustomerAuthContext = createContext(null);
const GUEST_STORAGE_KEY = "rotavoy_guest_session";
const SOCIAL_PHOTO_STORAGE_PREFIX = "rotavoy_social_photo_";

const FIREBASE_PROVIDERS = {
  google: googleAuthProvider,
  facebook: facebookAuthProvider,
};

function createGuestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readGuestSession() {
  try {
    const storedSession = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!storedSession) return null;
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
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function createInitials(value) {
  const normalized = String(value || "").replace(/@.*/, "").trim();
  if (!normalized) return "M";
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getFirebaseProviderProfile(user, providerId) {
  return user?.providerData?.find((item) => item?.providerId === providerId) || null;
}

function getStoredSocialPhoto(uid) {
  if (!uid) return "";
  try {
    return localStorage.getItem(`${SOCIAL_PHOTO_STORAGE_PREFIX}${uid}`) || "";
  } catch {
    return "";
  }
}

function storeSocialPhoto(uid, photoUrl) {
  if (!uid || !photoUrl) return;
  try {
    localStorage.setItem(`${SOCIAL_PHOTO_STORAGE_PREFIX}${uid}`, photoUrl);
  } catch {
    // The image can still be used for the current session.
  }
}

function getAdditionalProfilePicture(result) {
  const profile = getAdditionalUserInfo(result)?.profile;
  const picture = profile?.picture;
  if (typeof picture === "string") return picture;
  return picture?.data?.url || "";
}

async function resolveFacebookProfilePhoto(result) {
  const additionalProfilePicture = getAdditionalProfilePicture(result);
  if (additionalProfilePicture) return additionalProfilePicture;

  const credential = FacebookAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/me?fields=picture.type(large)&access_token=${encodeURIComponent(credential.accessToken)}`,
      );
      if (response.ok) {
        const payload = await response.json();
        if (payload?.picture?.data?.url) return payload.picture.data.url;
      }
    } catch {
      // Firebase photo URLs remain available as fallback.
    }
  }

  return (
    result?.user?.photoURL ||
    getFirebaseProviderProfile(result?.user, "facebook.com")?.photoURL ||
    ""
  );
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

function getSessionAccountKey(session) {
  if (!session?.provider || !session?.providerId) return "";
  return `${session.provider}:${session.providerId}`;
}

export function CustomerAuthProvider({ children }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [guestSession, setGuestSession] = useState(readGuestSession);
  const [busyAction, setBusyAction] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [socialProfileImage, setSocialProfileImage] = useState("");
  const [customerSession, setCustomerSession] = useState(getStoredCustomerSession);
  const [isBackendSessionReady, setIsBackendSessionReady] = useState(false);
  const [reownProfile, setReownProfile] = useState({ name: "", image: "" });

  const walletLoginPendingRef = useRef(false);
  const walletLoginInFlightRef = useRef(false);

  const { address: connectedAddress, isConnected: isWalletConnected } =
    useAppKitAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const applyCustomerSession = useCallback((nextSession) => {
    if (!nextSession?.token) return null;
    const stored = storeCustomerSession(nextSession);
    setCustomerSession(stored);
    setIsBackendSessionReady(true);
    return stored;
  }, []);

  const clearCustomerSession = useCallback(() => {
    clearStoredCustomerSession();
    setCustomerSession(null);
    setIsBackendSessionReady(true);
  }, []);

  const updateBackendCustomer = useCallback((customer) => {
    if (!customer) return;
    setCustomerSession((previous) => {
      if (!previous) return previous;
      const next = { ...previous, customer };
      storeCustomerSession(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const storedSession = getStoredCustomerSession();

    if (!storedSession) {
      setIsBackendSessionReady(true);
      return undefined;
    }

    validateCustomerSession()
      .then((validated) => {
        if (!cancelled && validated) applyCustomerSession(validated);
      })
      .catch(() => {
        if (!cancelled) clearCustomerSession();
      })
      .finally(() => {
        if (!cancelled) setIsBackendSessionReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [applyCustomerSession, clearCustomerSession]);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setFirebaseUser(nextUser);
      setIsFirebaseReady(true);

      if (!nextUser) {
        setSocialProfileImage("");
        if (getStoredCustomerSession()?.provider === "firebase") {
          clearCustomerSession();
        }
        return;
      }

      const providerPhoto = nextUser.providerData?.find(
        (item) => item?.photoURL,
      )?.photoURL;
      const storedPhoto = getStoredSocialPhoto(nextUser.uid);
      setSocialProfileImage(storedPhoto || nextUser.photoURL || providerPhoto || "");

      try {
        setBusyAction("firebaseSession");
        const idToken = await nextUser.getIdToken();
        const session = await createFirebaseCustomerSession(idToken);
        applyCustomerSession(session);
        localStorage.removeItem(GUEST_STORAGE_KEY);
        setGuestSession(null);
        setErrorCode("");
        setIsAuthModalOpen(false);
      } catch {
        setErrorCode("genericError");
        setIsAuthModalOpen(true);
      } finally {
        setBusyAction("");
      }
    });
  }, [applyCustomerSession, clearCustomerSession]);

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
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (
      customerSession ||
      !guestSession?.id ||
      !isBackendSessionReady ||
      firebaseUser
    ) {
      return;
    }

    let cancelled = false;
    setBusyAction("guestSession");
    createGuestCustomerSession(guestSession.id)
      .then((session) => {
        if (!cancelled) applyCustomerSession(session);
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(GUEST_STORAGE_KEY);
          setGuestSession(null);
          setErrorCode("genericError");
        }
      })
      .finally(() => {
        if (!cancelled) setBusyAction("");
      });

    return () => {
      cancelled = true;
    };
  }, [
    applyCustomerSession,
    customerSession,
    firebaseUser,
    guestSession,
    isBackendSessionReady,
  ]);

  const authenticateWallet = useCallback(
    async (walletAddress) => {
      if (!walletAddress || walletLoginInFlightRef.current) return;

      walletLoginInFlightRef.current = true;
      setBusyAction("wallet");
      setErrorCode("");

      try {
        const challenge = await createWalletChallenge(walletAddress);
        const signature = await signMessageAsync({
          account: walletAddress,
          message: challenge.message,
        });
        const session = await createWalletCustomerSession({
          address: walletAddress,
          challengeId: challenge.challengeId,
          signature,
        });

        applyCustomerSession(session);
        localStorage.removeItem(GUEST_STORAGE_KEY);
        setGuestSession(null);
        setIsAuthModalOpen(false);
      } catch {
        setErrorCode("genericError");
        setIsAuthModalOpen(true);
      } finally {
        walletLoginInFlightRef.current = false;
        walletLoginPendingRef.current = false;
        setBusyAction("");
      }
    },
    [applyCustomerSession, signMessageAsync],
  );

  useEffect(() => {
    if (
      walletLoginPendingRef.current &&
      isWalletConnected &&
      connectedAddress
    ) {
      authenticateWallet(connectedAddress);
    }
  }, [authenticateWallet, connectedAddress, isWalletConnected]);

  const sessionProvider = customerSession?.provider || null;
  const firebaseProviderId = firebaseUser?.providerData?.find(
    (item) => item?.providerId,
  )?.providerId;
  const authType =
    sessionProvider === "firebase"
      ? firebaseProviderId === "google.com"
        ? "google"
        : firebaseProviderId === "facebook.com"
          ? "facebook"
          : "email"
      : sessionProvider;
  const sessionCustomer = customerSession?.customer || null;
  const walletAddress =
    sessionProvider === "wallet"
      ? customerSession?.providerId || connectedAddress
      : connectedAddress;
  const profileEmail =
    sessionCustomer?.profile?.email || sessionCustomer?.email || firebaseUser?.email || "";
  const profileImage =
    sessionCustomer?.photoUrl ||
    socialProfileImage ||
    firebaseUser?.photoURL ||
    reownProfile.image ||
    "";
  const displayName =
    sessionCustomer?.profile?.fullName ||
    sessionCustomer?.displayName ||
    firebaseUser?.displayName ||
    (sessionProvider === "wallet"
      ? reownProfile.name || shortenAddress(walletAddress)
      : "") ||
    (sessionProvider === "guest" ? "Guest" : "");
  const accountKey = getSessionAccountKey(customerSession);
  const isAuthenticated = Boolean(customerSession?.token);
  const isGuest = sessionProvider === "guest";

  function openAuthModal() {
    setErrorCode("");
    setIsAuthModalOpen(true);
  }

  function closeAuthModal() {
    if (busyAction) return;
    setErrorCode("");
    setIsAuthModalOpen(false);
  }

  async function startSocialLogin(provider) {
    if (busyAction) return;
    const firebaseProvider = FIREBASE_PROVIDERS[provider];

    if (!firebaseProvider || !firebaseProviderAvailability[provider]) {
      setErrorCode("socialUnavailable");
      return;
    }

    setBusyAction(provider);
    setErrorCode("");

    try {
      const result = await signInWithPopup(firebaseAuth, firebaseProvider);
      let photo = result.user.photoURL || "";

      if (provider === "facebook") {
        photo = await resolveFacebookProfilePhoto(result);
      } else {
        photo =
          photo ||
          result.user.providerData?.find((item) => item?.photoURL)?.photoURL ||
          "";
      }

      if (photo) {
        setSocialProfileImage(photo);
        storeSocialPhoto(result.user.uid, photo);
      }
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
    if (busyAction) return;
    setErrorCode("");

    if (isWalletConnected && connectedAddress) {
      await authenticateWallet(connectedAddress);
      return;
    }

    walletLoginPendingRef.current = true;
    setBusyAction("walletConnect");

    try {
      await appKit.open({ view: "Connect" });
      if (!walletLoginInFlightRef.current) {
        setBusyAction("");
      }
    } catch {
      walletLoginPendingRef.current = false;
      setBusyAction("");
      setErrorCode("genericError");
      setIsAuthModalOpen(true);
    }
  }

  async function continueAsGuest() {
    if (busyAction) return;
    setBusyAction("guest");
    setErrorCode("");

    const nextGuestSession = guestSession?.id
      ? guestSession
      : { id: createGuestId(), createdAt: new Date().toISOString() };

    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(nextGuestSession));
      setGuestSession(nextGuestSession);
      const session = await createGuestCustomerSession(nextGuestSession.id);
      applyCustomerSession(session);
      setIsAuthModalOpen(false);
    } catch {
      setErrorCode("genericError");
      setIsAuthModalOpen(true);
    } finally {
      setBusyAction("");
    }
  }

  async function upgradeGuestAccount() {
    try {
      await logoutCustomerSession();
    } catch {
      clearStoredCustomerSession();
    }
    clearCustomerSession();
    localStorage.removeItem(GUEST_STORAGE_KEY);
    setGuestSession(null);
    setErrorCode("");
    setIsAuthModalOpen(true);
  }

  async function manageWallet() {
    if (!isWalletConnected) return;
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
    if (busyAction) return;
    setBusyAction("signOut");
    setErrorCode("");

    try {
      await logoutCustomerSession();
    } catch {
      clearStoredCustomerSession();
    }

    try {
      if (firebaseUser) await firebaseSignOut(firebaseAuth);
      if (isWalletConnected) await disconnect();
    } catch {
      setErrorCode("genericError");
    } finally {
      clearCustomerSession();
      localStorage.removeItem(GUEST_STORAGE_KEY);
      setSocialProfileImage("");
      setGuestSession(null);
      setIsAuthModalOpen(false);
      setBusyAction("");
    }
  }

  const value = {
    accountKey,
    address: walletAddress || "",
    authType,
    busyAction,
    closeAuthModal,
    continueAsGuest,
    customerSession,
    displayName,
    errorCode,
    firebaseUser,
    initials: createInitials(displayName || profileEmail || walletAddress),
    isAuthModalOpen,
    isAuthenticated,
    isBackendSessionReady,
    isConnected: isWalletConnected,
    isFirebaseAuthenticated: sessionProvider === "firebase",
    isFirebaseReady,
    isGuest,
    manageWallet,
    openAuthModal,
    profileEmail,
    profileImage,
    providerAvailability: firebaseProviderAvailability,
    signOut,
    startSocialLogin,
    startWalletLogin,
    updateBackendCustomer,
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
