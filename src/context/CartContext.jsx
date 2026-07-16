import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);

const CART_STORAGE_KEY = "rotavoy_cart";
const LEGACY_CART_STORAGE_KEY = "rotavoy_cart";
const MAX_ITEM_QUANTITY = 10;

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

function getMaximumQuantity(item) {
  const stock = Number(item?.stock);

  if (!Number.isFinite(stock)) {
    return MAX_ITEM_QUANTITY;
  }

  return Math.min(
    MAX_ITEM_QUANTITY,
    Math.max(0, Math.floor(stock)),
  );
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
    const maximumQuantity = getMaximumQuantity(product);

    if (maximumQuantity < 1) {
      return;
    }

    const safeQuantity = Math.max(
      1,
      Math.min(
        maximumQuantity,
        Number.parseInt(quantity, 10) || 1,
      ),
    );

    setCartItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.key === product.key,
      );

      if (existingItem) {
        return currentItems.map((item) => {
          if (item.key !== product.key) return item;

          const itemMaximumQuantity = getMaximumQuantity({
            ...item,
            stock: product.stock ?? item.stock,
          });

          return {
            ...item,
            stock: product.stock ?? item.stock,
            quantity: Math.min(
              itemMaximumQuantity,
              item.quantity + safeQuantity,
            ),
          };
        });
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
          stock: product.stock,
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
          ? {
              ...item,
              quantity: Math.min(
                getMaximumQuantity(item),
                item.quantity + 1,
              ),
            }
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
