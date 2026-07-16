import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  claimCustomerOrders,
  fetchCustomerAccount,
  saveCustomerAccount,
} from "../services/customerApi";
import { useCustomerAuth } from "./CustomerAuthContext";

const CustomerAccountContext = createContext(null);
const LEGACY_STORAGE_PREFIX = "rotavoy_customer_account:";
const LEGACY_ORDERS_KEY = "rotavoy_orders";

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeProduct(product) {
  return {
    key: product.key,
    title: product.title,
    price: Number(product.price || 0),
    oldPrice: Number(product.oldPrice || 0) || null,
    imageUrl: product.imageUrl || "",
    categoryKey: product.categoryKey || "",
    category: product.category || "",
    badge: product.badge || "",
  };
}

function createInitialData(displayName, profileEmail) {
  return {
    profile: {
      fullName: displayName || "",
      email: profileEmail || "",
      phone: "",
    },
    addresses: [],
    favorites: [],
  };
}

function mergeUniqueAddresses(primary = [], secondary = []) {
  const result = [...primary];

  for (const address of secondary) {
    const exists = result.some(
      (item) =>
        String(item.city || "").toLowerCase() ===
          String(address.city || "").toLowerCase() &&
        String(item.address || "").toLowerCase() ===
          String(address.address || "").toLowerCase(),
    );
    if (!exists) result.push(address);
  }

  if (result.length > 0 && !result.some((item) => item.isDefault)) {
    result[0] = { ...result[0], isDefault: true };
  }

  return result;
}

function mergeUniqueFavorites(primary = [], secondary = []) {
  const result = [...primary];
  const keys = new Set(result.map((item) => item.key));

  for (const favorite of secondary) {
    if (favorite?.key && !keys.has(favorite.key)) {
      result.push(favorite);
      keys.add(favorite.key);
    }
  }

  return result;
}

function mergeAccountData(serverData, localData, displayName, profileEmail) {
  const initialData = createInitialData(displayName, profileEmail);
  const serverProfile = serverData?.profile || {};
  const localProfile = localData?.profile || {};

  return {
    profile: {
      fullName:
        serverProfile.fullName || localProfile.fullName || initialData.profile.fullName,
      email: serverProfile.email || localProfile.email || initialData.profile.email,
      phone: serverProfile.phone || localProfile.phone || "",
    },
    addresses: mergeUniqueAddresses(
      Array.isArray(serverData?.addresses) ? serverData.addresses : [],
      Array.isArray(localData?.addresses) ? localData.addresses : [],
    ),
    favorites: mergeUniqueFavorites(
      Array.isArray(serverData?.favorites) ? serverData.favorites : [],
      Array.isArray(localData?.favorites) ? localData.favorites : [],
    ),
  };
}

function buildOrderClaims(orders) {
  if (!Array.isArray(orders)) return [];

  return orders
    .map((order) => ({
      orderNumber: order?.orderId || order?._id || order?.id || "",
      email: order?.customer?.email || order?.email || "",
    }))
    .filter((claim) => claim.orderNumber && claim.email)
    .slice(0, 50);
}

export function CustomerAccountProvider({ children }) {
  const {
    accountKey,
    customerSession,
    displayName,
    isAuthenticated,
    profileEmail,
    updateBackendCustomer,
  } = useCustomerAuth();

  const [data, setData] = useState(() =>
    createInitialData(displayName, profileEmail),
  );
  const [orders, setOrders] = useState([]);
  const [loadedToken, setLoadedToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [renderVersion, setRenderVersion] = useState(0);
  const lastSavedRef = useRef("");

  const sessionToken = customerSession?.token || "";

  useEffect(() => {
    if (!isAuthenticated || !sessionToken || !accountKey) {
      setData(createInitialData(displayName, profileEmail));
      setOrders([]);
      setLoadedToken("");
      setIsLoading(false);
      setSyncError("");
      lastSavedRef.current = "";
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    setSyncError("");

    async function loadAccount() {
      const legacyStorageKey = `${LEGACY_STORAGE_PREFIX}${accountKey}`;
      const legacyData = safeParse(localStorage.getItem(legacyStorageKey), null);
      const legacyOrders = safeParse(localStorage.getItem(LEGACY_ORDERS_KEY), []);
      const response = await fetchCustomerAccount();
      let mergedData = mergeAccountData(
        response.account,
        legacyData,
        displayName,
        profileEmail,
      );

      const serverDataFingerprint = JSON.stringify({
        profile: response.account?.profile || {},
        addresses: response.account?.addresses || [],
        favorites: response.account?.favorites || [],
      });
      const mergedFingerprint = JSON.stringify(mergedData);
      let customer = response.customer;

      if (serverDataFingerprint !== mergedFingerprint) {
        const saved = await saveCustomerAccount(mergedData);
        mergedData = saved.account;
        customer = saved.customer;
      }

      const claims = buildOrderClaims(legacyOrders);
      let nextOrders = Array.isArray(response.account?.orders)
        ? response.account.orders
        : [];

      if (claims.length > 0) {
        const claimed = await claimCustomerOrders(claims);
        nextOrders = Array.isArray(claimed.orders) ? claimed.orders : nextOrders;
      }

      if (cancelled) return;

      lastSavedRef.current = JSON.stringify(mergedData);
      setData(mergedData);
      setOrders(nextOrders);
      setLoadedToken(sessionToken);
      updateBackendCustomer(customer);
      localStorage.setItem(LEGACY_ORDERS_KEY, JSON.stringify(nextOrders));
      localStorage.removeItem(legacyStorageKey);
      setRenderVersion((previous) => previous + 1);
    }

    loadAccount()
      .catch((error) => {
        if (!cancelled) {
          setSyncError(error.message || "Customer account could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    accountKey,
    displayName,
    isAuthenticated,
    profileEmail,
    sessionToken,
    updateBackendCustomer,
  ]);

  useEffect(() => {
    if (!sessionToken || loadedToken !== sessionToken || !isAuthenticated) return undefined;

    const fingerprint = JSON.stringify(data);
    if (fingerprint === lastSavedRef.current) return undefined;

    const timer = window.setTimeout(() => {
      saveCustomerAccount(data)
        .then((response) => {
          const savedData = response.account;
          lastSavedRef.current = JSON.stringify(savedData);
          setData(savedData);
          updateBackendCustomer(response.customer);
          setSyncError("");
        })
        .catch((error) => {
          setSyncError(error.message || "Customer account could not be saved.");
        });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    data,
    isAuthenticated,
    loadedToken,
    sessionToken,
    updateBackendCustomer,
  ]);

  function saveProfile(nextProfile) {
    setData((previous) => ({
      ...previous,
      profile: { ...previous.profile, ...nextProfile },
    }));
  }

  function addAddress(address) {
    const nextAddress = {
      id: createId("address"),
      label: address.label?.trim() || "Address",
      fullName: address.fullName?.trim() || "",
      phone: address.phone?.trim() || "",
      city: address.city?.trim() || "",
      country: address.country?.trim() || "",
      address: address.address?.trim() || "",
      isDefault: false,
    };

    setData((previous) => {
      const hasDefaultAddress = previous.addresses.some((item) => item.isDefault);
      return {
        ...previous,
        addresses: [
          ...previous.addresses,
          { ...nextAddress, isDefault: !hasDefaultAddress },
        ],
      };
    });

    return nextAddress.id;
  }

  function removeAddress(addressId) {
    setData((previous) => {
      const removedAddress = previous.addresses.find((item) => item.id === addressId);
      const remainingAddresses = previous.addresses.filter(
        (item) => item.id !== addressId,
      );

      if (removedAddress?.isDefault && remainingAddresses.length > 0) {
        remainingAddresses[0] = { ...remainingAddresses[0], isDefault: true };
      }

      return { ...previous, addresses: remainingAddresses };
    });
  }

  function setDefaultAddress(addressId) {
    setData((previous) => ({
      ...previous,
      addresses: previous.addresses.map((item) => ({
        ...item,
        isDefault: item.id === addressId,
      })),
    }));
  }

  function isFavorite(productKey) {
    return data.favorites.some((item) => item.key === productKey);
  }

  function toggleFavorite(product) {
    if (!isAuthenticated || !product?.key) return false;
    const alreadyFavorite = data.favorites.some((item) => item.key === product.key);

    setData((previous) => ({
      ...previous,
      favorites: alreadyFavorite
        ? previous.favorites.filter((item) => item.key !== product.key)
        : [sanitizeProduct(product), ...previous.favorites],
    }));

    return !alreadyFavorite;
  }

  function rememberCheckoutDetails(checkoutData) {
    if (!isAuthenticated) return;

    const fullName = checkoutData.fullName?.trim() || "";
    const email = checkoutData.email?.trim() || "";
    const phone = checkoutData.phone?.trim() || "";
    const city = checkoutData.city?.trim() || "";
    const address = checkoutData.address?.trim() || "";
    const country = checkoutData.country?.trim() || "";

    setData((previous) => {
      const alreadySaved = previous.addresses.some(
        (item) =>
          item.city.toLowerCase() === city.toLowerCase() &&
          item.address.toLowerCase() === address.toLowerCase(),
      );
      const nextAddresses =
        city && address && !alreadySaved
          ? [
              ...previous.addresses,
              {
                id: createId("address"),
                label: previous.addresses.length === 0 ? "Home" : "Address",
                fullName,
                phone,
                city,
                country,
                address,
                isDefault: previous.addresses.length === 0,
              },
            ]
          : previous.addresses;

      return {
        ...previous,
        profile: { fullName, email, phone },
        addresses: nextAddresses,
      };
    });
  }

  const defaultAddress = useMemo(
    () => data.addresses.find((item) => item.isDefault) || data.addresses[0] || null,
    [data.addresses],
  );

  const value = {
    addAddress,
    addresses: data.addresses,
    defaultAddress,
    favoriteProducts: data.favorites,
    isFavorite,
    isLoading,
    orders,
    profile: data.profile,
    rememberCheckoutDetails,
    removeAddress,
    saveProfile,
    setDefaultAddress,
    syncError,
    toggleFavorite,
  };

  return (
    <CustomerAccountContext.Provider value={value}>
      <Fragment key={renderVersion}>{children}</Fragment>
    </CustomerAccountContext.Provider>
  );
}

export function useCustomerAccount() {
  const context = useContext(CustomerAccountContext);
  if (!context) {
    throw new Error(
      "useCustomerAccount must be used inside CustomerAccountProvider",
    );
  }
  return context;
}
