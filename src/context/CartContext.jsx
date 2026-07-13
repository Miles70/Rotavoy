import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);

const CART_STORAGE_KEY = "gabaloo_cart";
const LEGACY_CART_STORAGE_KEY = "kemalreis_cart";

function getStoredCart() {
  try {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);

    if (storedCart) {
      return JSON.parse(storedCart);
    }

    const legacyCart = localStorage.getItem(LEGACY_CART_STORAGE_KEY);

    if (!legacyCart) {
      return [];
    }

    const parsedLegacyCart = JSON.parse(legacyCart);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(parsedLegacyCart));
    localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
    return parsedLegacyCart;
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(getStoredCart);
  const [lastAddedItem, setLastAddedItem] = useState(null);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
  }, [cartItems]);

  useEffect(() => {
    if (!lastAddedItem) {
      return;
    }

    const timer = setTimeout(() => {
      setLastAddedItem(null);
    }, 2200);

    return () => clearTimeout(timer);
  }, [lastAddedItem]);

  function addToCart(product, quantity = 1) {
    const safeQuantity = Math.max(
      1,
      Math.min(99, Number.parseInt(quantity, 10) || 1),
    );

    setCartItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.key === product.key,
      );

      if (existingItem) {
        return currentItems.map((item) =>
          item.key === product.key
            ? { ...item, quantity: item.quantity + safeQuantity }
            : item,
        );
      }

      return [
        ...currentItems,
        {
          key: product.key,
          title: product.title,
          categoryKey: product.categoryKey,
          price: product.price,
          image: product.image,
          imageUrl: product.imageUrl,
          quantity: safeQuantity,
        },
      ];
    });

    setLastAddedItem({
      key: product.key,
      title: product.title,
      image: product.image,
      imageUrl: product.imageUrl,
      price: product.price,
      quantity: safeQuantity,
    });
  }

  function increaseQuantity(productKey) {
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.key === productKey
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      ),
    );
  }

  function decreaseQuantity(productKey) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.key === productKey
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeFromCart(productKey) {
    setCartItems((currentItems) =>
      currentItems.filter((item) => item.key !== productKey),
    );
  }

  function clearCart() {
    setCartItems([]);
  }

  function closeCartToast() {
    setLastAddedItem(null);
  }

  const cartCount = useMemo(() => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  }, [cartItems]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );
  }, [cartItems]);

  const value = {
    cartItems,
    cartCount,
    cartTotal,
    lastAddedItem,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    clearCart,
    closeCartToast,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
