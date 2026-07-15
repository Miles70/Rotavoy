import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useCustomerAuth } from "./CustomerAuthContext";

const CustomerAccountContext = createContext(null);
const STORAGE_PREFIX = "masterota_customer_account:";

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

export function CustomerAccountProvider({ children }) {
  const {
    accountKey,
    displayName,
    isAuthenticated,
    profileEmail,
  } = useCustomerAuth();

  const [data, setData] = useState(() =>
    createInitialData(displayName, profileEmail),
  );
  const [loadedKey, setLoadedKey] = useState("");

  useEffect(() => {
    if (!accountKey || !isAuthenticated) {
      setData(createInitialData(displayName, profileEmail));
      setLoadedKey("");
      return;
    }

    const storageKey = `${STORAGE_PREFIX}${accountKey}`;
    const storedData = safeParse(localStorage.getItem(storageKey), null);
    const initialData = createInitialData(displayName, profileEmail);

    setData({
      profile: {
        ...initialData.profile,
        ...(storedData?.profile || {}),
      },
      addresses: Array.isArray(storedData?.addresses)
        ? storedData.addresses
        : [],
      favorites: Array.isArray(storedData?.favorites)
        ? storedData.favorites
        : [],
    });
    setLoadedKey(accountKey);
  }, [accountKey, displayName, isAuthenticated, profileEmail]);

  useEffect(() => {
    if (!accountKey || loadedKey !== accountKey || !isAuthenticated) {
      return;
    }

    localStorage.setItem(`${STORAGE_PREFIX}${accountKey}`, JSON.stringify(data));
  }, [accountKey, data, isAuthenticated, loadedKey]);

  function saveProfile(nextProfile) {
    setData((previous) => ({
      ...previous,
      profile: {
        ...previous.profile,
        ...nextProfile,
      },
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
          {
            ...nextAddress,
            isDefault: !hasDefaultAddress,
          },
        ],
      };
    });

    return nextAddress.id;
  }

  function removeAddress(addressId) {
    setData((previous) => {
      const removedAddress = previous.addresses.find(
        (item) => item.id === addressId,
      );
      const remainingAddresses = previous.addresses.filter(
        (item) => item.id !== addressId,
      );

      if (removedAddress?.isDefault && remainingAddresses.length > 0) {
        remainingAddresses[0] = {
          ...remainingAddresses[0],
          isDefault: true,
        };
      }

      return {
        ...previous,
        addresses: remainingAddresses,
      };
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
    if (!isAuthenticated || !product?.key) {
      return false;
    }

    const alreadyFavorite = data.favorites.some(
      (item) => item.key === product.key,
    );

    setData((previous) => ({
      ...previous,
      favorites: alreadyFavorite
        ? previous.favorites.filter((item) => item.key !== product.key)
        : [sanitizeProduct(product), ...previous.favorites],
    }));

    return !alreadyFavorite;
  }

  function rememberCheckoutDetails(checkoutData) {
    if (!isAuthenticated) {
      return;
    }

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
        profile: {
          fullName,
          email,
          phone,
        },
        addresses: nextAddresses,
      };
    });
  }

  const defaultAddress = useMemo(() => {
    return data.addresses.find((item) => item.isDefault) || data.addresses[0] || null;
  }, [data.addresses]);

  const value = {
    addAddress,
    addresses: data.addresses,
    defaultAddress,
    favoriteProducts: data.favorites,
    isFavorite,
    profile: data.profile,
    rememberCheckoutDetails,
    removeAddress,
    saveProfile,
    setDefaultAddress,
    toggleFavorite,
  };

  return (
    <CustomerAccountContext.Provider value={value}>
      {children}
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
