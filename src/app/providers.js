"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { PRODUCTS } from "@/lib/products";

const CartContext = createContext(null);
const AuthContext = createContext(null);

const CART_KEY = "shopai_cart";
const AUTH_KEY = "shopai_user";

function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage on mount
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  function addItem(id, qty = 1) {
    setItems((prev) => {
      const existing = prev.find((it) => it.id === id);
      if (existing) {
        return prev.map((it) =>
          it.id === id ? { ...it, qty: it.qty + qty } : it
        );
      }
      return [...prev, { id, qty }];
    });
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function updateQty(id, qty) {
    if (qty <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, qty } : it)));
  }

  function clearCart() {
    setItems([]);
  }

  const detailedItems = items
    .map((it) => {
      const product = PRODUCTS.find((p) => p.id === it.id);
      return product ? { ...it, product } : null;
    })
    .filter(Boolean);

  const totalCount = items.reduce((sum, it) => sum + it.qty, 0);
  const totalPrice = detailedItems.reduce(
    (sum, it) => sum + it.product.price * it.qty,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items: detailedItems,
        totalCount,
        totalPrice,
        addItem,
        removeItem,
        updateQty,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage on mount
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true);
  }, []);

  function login(email) {
    const nextUser = { email };
    setUser(nextUser);
    localStorage.setItem(AUTH_KEY, JSON.stringify(nextUser));
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, hydrated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function Providers({ children }) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within Providers");
  return ctx;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within Providers");
  return ctx;
}
