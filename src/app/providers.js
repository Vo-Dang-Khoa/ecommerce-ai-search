"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { PRODUCTS } from "@/lib/products";
import { getEffectivePrice } from "@/lib/shops";
import { supabase } from "@/lib/supabaseClient";

const CartContext = createContext(null);
const AuthContext = createContext(null);
const ShopContext = createContext(null);

const CART_KEY = "shopai_cart";

// Đăng nhập/đăng ký thật bằng Supabase Auth (email + mật khẩu). Vai trò
// (buyer/seller) được lưu trong bảng `profiles`, tự tạo qua trigger
// `on_auth_user_created` (xem supabase/schema.sql) ngay khi signUp() thành
// công, lấy từ metadata `role` gửi kèm lúc đăng ký.
function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(userId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, email")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[AuthProvider] Không tải được profile:", error);
        setProfile(null);
      } else {
        setProfile(data);
      }
    }

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      if (!cancelled) setHydrated(true);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  // role: "buyer" | "seller" — chọn lúc đăng ký, lưu vào auth metadata rồi
  // trigger DB copy sang bảng profiles.
  async function signUp({ email, password, role }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role } },
    });
    if (error) throw error;
    // Nếu project bật "Confirm email", data.session sẽ là null cho tới khi
    // người dùng bấm link xác nhận trong hộp thư — trang /register cần biết
    // điều này để hiện thông báo phù hợp thay vì điều hướng ngay.
    return { needsEmailConfirmation: !data.session };
  }

  async function signIn({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        role: profile?.role ?? "buyer",
      }
    : null;

  return (
    <AuthContext.Provider value={{ user, signUp, signIn, logout, hydrated }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Chuyển đổi giữa cột snake_case của Postgres và object camelCase mà
// phần còn lại của app (ProductCard, seller pages...) đang dùng, để không
// phải sửa lại toàn bộ UI đã có.
function mapShop(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerEmail: row.owner_email,
    name: row.name,
    description: row.description,
    phone: row.phone,
    createdAt: row.created_at,
  };
}

function mapProduct(row) {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    desc: row.description,
    images: row.images || [],
    promotion: row.promotion,
    createdAt: row.created_at,
  };
}

function ShopProvider({ children }) {
  const { user } = useAuth();
  const [shops, setShops] = useState([]);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Tải toàn bộ shops + products (của mọi gian hàng) từ Supabase 1 lần khi
  // app khởi động. Đây là bản demo đơn giản: mọi thay đổi (thêm/sửa/xoá)
  // sẽ cập nhật lại state cục bộ ngay sau khi Supabase xác nhận thành công,
  // KHÔNG dùng realtime subscription.
  useEffect(() => {
    let cancelled = false;

    async function loadFromSupabase() {
      try {
        const [shopsRes, productsRes] = await Promise.all([
          supabase.from("shops").select("*").order("created_at", { ascending: true }),
          supabase.from("products").select("*").order("created_at", { ascending: true }),
        ]);

        if (shopsRes.error) throw shopsRes.error;
        if (productsRes.error) throw productsRes.error;
        if (cancelled) return;

        setShops((shopsRes.data || []).map(mapShop));
        setSellerProducts((productsRes.data || []).map(mapProduct));
      } catch (err) {
        if (!cancelled) {
          console.error("[ShopProvider] Không tải được dữ liệu từ Supabase:", err);
          setLoadError(
            "Không tải được dữ liệu gian hàng từ Supabase. Kiểm tra lại NEXT_PUBLIC_SUPABASE_URL / " +
              "NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local, và đã chạy supabase/schema.sql chưa."
          );
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    loadFromSupabase();
    return () => {
      cancelled = true;
    };
  }, []);

  const myShop = user ? shops.find((s) => s.ownerId === user.id) ?? null : null;

  async function registerShop({ name, description, phone }) {
    if (!user) throw new Error("Bạn cần đăng nhập trước.");
    if (user.role !== "seller") {
      throw new Error(
        "Tài khoản của bạn đang ở vai trò Người mua, không thể tạo gian hàng."
      );
    }
    const { data, error } = await supabase
      .from("shops")
      .insert({
        owner_id: user.id,
        owner_email: user.email,
        name,
        description: description || "",
        phone: phone || "",
      })
      .select()
      .single();
    if (error) throw error;

    const shop = mapShop(data);
    setShops((prev) => [...prev, shop]);
    return shop;
  }

  async function updateShop(patch) {
    if (!myShop) return;
    const dbPatch = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.description !== undefined) dbPatch.description = patch.description;
    if (patch.phone !== undefined) dbPatch.phone = patch.phone;

    const { error } = await supabase.from("shops").update(dbPatch).eq("id", myShop.id);
    if (error) throw error;

    setShops((prev) => prev.map((s) => (s.id === myShop.id ? { ...s, ...patch } : s)));
  }

  async function addProduct({ name, category, price, desc, images = [] }) {
    if (!myShop) throw new Error("Bạn cần đăng ký gian hàng trước.");
    const { data, error } = await supabase
      .from("products")
      .insert({
        shop_id: myShop.id,
        name,
        category,
        price: Math.max(0, Math.round(Number(price) || 0)),
        description: desc || "",
        images,
        promotion: null,
      })
      .select()
      .single();
    if (error) throw error;

    const product = mapProduct(data);
    setSellerProducts((prev) => [...prev, product]);
    return product;
  }

  async function removeProduct(productId) {
    if (!myShop) return;
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("shop_id", myShop.id);
    if (error) throw error;

    setSellerProducts((prev) => prev.filter((p) => p.id !== productId));
  }

  async function updateProduct(productId, patch) {
    const dbPatch = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.price !== undefined) dbPatch.price = patch.price;
    if (patch.desc !== undefined) dbPatch.description = patch.desc;
    if (patch.images !== undefined) dbPatch.images = patch.images;
    if (patch.promotion !== undefined) dbPatch.promotion = patch.promotion;

    const { error } = await supabase.from("products").update(dbPatch).eq("id", productId);
    if (error) throw error;

    setSellerProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...patch } : p))
    );
  }

  async function setPrice(productId, price) {
    await updateProduct(productId, { price: Math.max(0, Math.round(Number(price) || 0)) });
  }

  async function adjustPrice(productId, deltaPercent) {
    const product = sellerProducts.find((p) => p.id === productId);
    if (!product) return;
    const next =
      Math.max(0, Math.round((product.price * (1 + deltaPercent / 100)) / 500)) * 500;
    await updateProduct(productId, { price: next });
  }

  // addImage/replaceImage nhận vào URL ảnh đã có sẵn (do trang gọi
  // uploadProductImage() lên Supabase Storage trước, rồi mới gọi các hàm
  // này để lưu URL đó vào cột `images` của sản phẩm).
  async function addImage(productId, url) {
    const product = sellerProducts.find((p) => p.id === productId);
    if (!product) return;
    const nextImages = [...(product.images || []), url];
    await updateProduct(productId, { images: nextImages });
  }

  async function removeImage(productId, index) {
    const product = sellerProducts.find((p) => p.id === productId);
    if (!product) return;
    const nextImages = (product.images || []).filter((_, i) => i !== index);
    await updateProduct(productId, { images: nextImages });
  }

  async function replaceImage(productId, index, url) {
    const product = sellerProducts.find((p) => p.id === productId);
    if (!product) return;
    const nextImages = (product.images || []).map((img, i) => (i === index ? url : img));
    await updateProduct(productId, { images: nextImages });
  }

  async function setPromotion(productId, promotion) {
    await updateProduct(productId, { promotion });
  }

  async function removePromotion(productId) {
    await updateProduct(productId, { promotion: null });
  }

  const myShopProducts = myShop
    ? sellerProducts.filter((p) => p.shopId === myShop.id)
    : [];

  // Sản phẩm demo tĩnh (src/lib/products.js) + sản phẩm thật từ Supabase
  const allProducts = [...PRODUCTS, ...sellerProducts];

  return (
    <ShopContext.Provider
      value={{
        hydrated,
        loadError,
        myShop,
        myShopProducts,
        allProducts,
        registerShop,
        updateShop,
        addProduct,
        removeProduct,
        updateProduct,
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
