"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { PRODUCTS } from "@/lib/products";
import { genId, getEffectivePrice } from "@/lib/shops";

const CartContext = createContext(null);
const AuthContext = createContext(null);
const ShopContext = createContext(null);

const CART_KEY = "shopai_cart";
const AUTH_KEY = "shopai_user";
const SHOPS_KEY = "shopai_shops";
const SELLER_PRODUCTS_KEY = "shopai_seller_products";

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

function ShopProvider({ children }) {
  const { user } = useAuth();
  const [shops, setShops] = useState([]);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const rawShops = localStorage.getItem(SHOPS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage on mount
      if (rawShops) setShops(JSON.parse(rawShops));
      const rawProducts = localStorage.getItem(SELLER_PRODUCTS_KEY);
      if (rawProducts) setSellerProducts(JSON.parse(rawProducts));
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SHOPS_KEY, JSON.stringify(shops));
  }, [shops, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SELLER_PRODUCTS_KEY, JSON.stringify(sellerProducts));
  }, [sellerProducts, hydrated]);

  const myShop = user ? shops.find((s) => s.ownerEmail === user.email) ?? null : null;

  function registerShop({ name, description, phone }) {
    if (!user) throw new Error("Bạn cần đăng nhập trước.");
    const shop = {
      id: genId("shop"),
      ownerEmail: user.email,
      name,
      description: description || "",
      phone: phone || "",
      createdAt: Date.now(),
    };
    setShops((prev) => [...prev, shop]);
    return shop;
  }

  function updateShop(patch) {
    if (!myShop) return;
    setShops((prev) =>
      prev.map((s) => (s.id === myShop.id ? { ...s, ...patch } : s))
    );
  }

  function addProduct({ name, category, price, desc, images = [] }) {
    if (!myShop) throw new Error("Bạn cần đăng ký gian hàng trước.");
    const product = {
      id: genId("p"),
      shopId: myShop.id,
      name,
      category,
      price: Math.max(0, Math.round(Number(price) || 0)),
      desc: desc || "",
      images,
      promotion: null,
      createdAt: Date.now(),
    };
    setSellerProducts((prev) => [...prev, product]);
    return product;
  }

  function removeProduct(productId) {
    setSellerProducts((prev) =>
      prev.filter((p) => !(p.id === productId && p.shopId === myShop?.id))
    );
  }

  function updateProduct(productId, patch) {
    setSellerProducts((prev) =>
      prev.map((p) =>
        p.id === productId && p.shopId === myShop?.id ? { ...p, ...patch } : p
      )
    );
  }

  function setPrice(productId, price) {
    updateProduct(productId, { price: Math.max(0, Math.round(Number(price) || 0)) });
  }

  function adjustPrice(productId, deltaPercent) {
    const product = sellerProducts.find((p) => p.id === productId);
    if (!product) return;
    const next =
      Math.max(0, Math.round((product.price * (1 + deltaPercent / 100)) / 500)) * 500;
    updateProduct(productId, { price: next });
  }

  function addImage(productId, dataUrl) {
    setSellerProducts((prev) =>
      prev.map((p) =>
        p.id === productId && p.shopId === myShop?.id
          ? { ...p, images: [...(p.images || []), dataUrl] }
          : p
      )
    );
  }

  function removeImage(productId, index) {
    setSellerProducts((prev) =>
      prev.map((p) =>
        p.id === productId && p.shopId === myShop?.id
          ? { ...p, images: (p.images || []).filter((_, i) => i !== index) }
          : p
      )
    );
  }

  function replaceImage(productId, index, dataUrl) {
    setSellerProducts((prev) =>
      prev.map((p) =>
        p.id === productId && p.shopId === myShop?.id
          ? {
              ...p,
              images: (p.images || []).map((img, i) => (i === index ? dataUrl : img)),
            }
          : p
      )
    );
  }

  function setPromotion(productId, promotion) {
    updateProduct(productId, { promotion });
  }

  function removePromotion(productId) {
    updateProduct(productId, { promotion: null });
  }

  const myShopProducts = myShop
    ? sellerProducts.filter((p) => p.shopId === myShop.id)
    : [];

  const allProducts = [...PRODUCTS, ...sellerProducts];

  return (
    <ShopContext.Provider
      value={{
        hydrated,
        myShop,
        myShopProducts,
        allProducts,
        registerShop,
        updateShop,
        addProduct,
        removeProduct,
        setPrice,
        adjustPrice,
        addImage,
        removeImage,
        replaceImage,
        setPromotion,
        removePromotion,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}

function CartProvider({ children }) {
  const { allProducts } = useShop();
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
      const product = allProducts.find((p) => p.id === it.id);
      return product ? { ...it, product } : null;
    })
    .filter(Boolean);

  const totalCount = items.reduce((sum, it) => sum + it.qty, 0);
  const totalPrice = detailedItems.reduce(
    (sum, it) => sum + getEffectivePrice(it.product) * it.qty,
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

export function Providers({ children }) {
  return (
    <AuthProvider>
      <ShopProvider>
        <CartProvider>{children}</CartProvider>
      </ShopProvider>
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

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within Providers");
  return ctx;
}
