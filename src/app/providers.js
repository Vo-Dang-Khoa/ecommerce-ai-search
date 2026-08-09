"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { PRODUCTS } from "@/lib/products";
import { getEffectivePrice, getProductImage } from "@/lib/shops";
import { supabase } from "@/lib/supabaseClient";

const CartContext = createContext(null);
const AuthContext = createContext(null);
const ShopContext = createContext(null);
const OrdersContext = createContext(null);

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
        .select("role, email, phone, address")
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Trả về role ngay lập tức (thay vì chờ onAuthStateChange cập nhật state
    // bất đồng bộ) để nơi gọi signIn() biết ngay nên điều hướng tới đâu
    // (vd: /seller nếu là Người bán).
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    return { role: profileData?.role ?? "buyer" };
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  // Lưu lại số điện thoại/địa chỉ giao hàng của khách (dùng ở trang
  // /checkout) vào bảng profiles, để lần đặt hàng sau tự điền sẵn.
  async function updateProfile({ phone, address }) {
    if (!session?.user) throw new Error("Bạn cần đăng nhập trước.");
    const patch = {};
    if (phone !== undefined) patch.phone = phone;
    if (address !== undefined) patch.address = address;

    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", session.user.id);
    if (error) throw error;

    setProfile((prev) => ({ ...prev, ...patch }));
  }

  // Đổi email đăng nhập. Theo mặc định Supabase Auth yêu cầu xác nhận qua
  // link gửi tới email mới (và cả email cũ, nếu bật "Secure email change")
  // trước khi email thật sự đổi — nên session.user.email KHÔNG cập nhật
  // ngay lập tức, trang /account cần tự hiển thị thông báo "kiểm tra email"
  // thay vì coi như đã đổi xong.
  async function updateEmail(newEmail) {
    if (!session?.user) throw new Error("Bạn cần đăng nhập trước.");
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw error;
  }

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        role: profile?.role ?? "buyer",
        phone: profile?.phone ?? "",
        address: profile?.address ?? "",
      }
    : null;

  return (
    <AuthContext.Provider
      value={{ user, signUp, signIn, logout, updateProfile, updateEmail, hydrated }}
    >
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

// --- Chuyển đổi 1 dòng orders + các dòng order_items liên quan thành 1
// object đơn hàng cho UI (trang /account) dùng.
function mapOrder(row, itemRows) {
  return {
    id: row.id,
    status: row.status,
    paymentMethod: row.payment_method,
    shippingMethod: row.shipping_method,
    shippingFee: Number(row.shipping_fee),
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    address: row.address,
    phone: row.phone,
    createdAt: row.created_at,
    items: (itemRows || []).map((it) => ({
      id: it.id,
      productId: it.product_id,
      name: it.product_name,
      image: it.product_image,
      unitPrice: Number(it.unit_price),
      qty: it.qty,
    })),
  };
}

// Đơn hàng của Người mua — tạo ra ở trang /checkout, xem lại/huỷ/xác nhận
// đã nhận hàng ở trang /account (mục "Người mua" trong header). Bất kỳ tài
// khoản đã đăng nhập nào (buyer lẫn seller) đều có thể đặt hàng và có lịch
// sử đơn hàng riêng — orders được lọc theo buyer_id = tài khoản hiện tại.
function OrdersProvider({ children }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setOrders([]);
        setLoadError("");
        setHydrated(true);
        return;
      }
      try {
        const { data: orderRows, error: ordersErr } = await supabase
          .from("orders")
          .select("*")
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false });
        if (ordersErr) throw ordersErr;

        const orderIds = (orderRows || []).map((o) => o.id);
        let itemRows = [];
        if (orderIds.length > 0) {
          const { data, error: itemsErr } = await supabase
            .from("order_items")
            .select("*")
            .in("order_id", orderIds);
          if (itemsErr) throw itemsErr;
          itemRows = data || [];
        }
        if (cancelled) return;

        setOrders(
          (orderRows || []).map((row) =>
            mapOrder(
              row,
              itemRows.filter((it) => it.order_id === row.id)
            )
          )
        );
        setLoadError("");
      } catch (err) {
        if (!cancelled) {
          console.error("[OrdersProvider] Không tải được đơn hàng:", err);
          setLoadError(
            "Không tải được lịch sử đơn hàng từ Supabase. Có thể project chưa chạy " +
              "supabase/schema.sql (bản mới nhất) để tạo bảng orders/order_items."
          );
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    setHydrated(false);
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // items: mảng { product, qty } lấy từ useCart().items ngay trước khi
  // clearCart() ở trang /checkout.
  async function placeOrder({
    items,
    paymentMethod,
    shippingMethod,
    shippingFee,
    subtotal,
    total,
    address,
    phone,
  }) {
    if (!user) throw new Error("Bạn cần đăng nhập trước.");

    const { data: orderRow, error: orderErr } = await supabase
      .from("orders")
      .insert({
        buyer_id: user.id,
        status: "processing",
        payment_method: paymentMethod,
        shipping_method: shippingMethod,
        shipping_fee: shippingFee,
        subtotal,
        total,
        address,
        phone,
      })
      .select()
      .single();
    if (orderErr) throw orderErr;

    const itemRows = items.map((it) => ({
      order_id: orderRow.id,
      product_id: String(it.product.id),
      product_name: it.product.name,
      product_image: getProductImage(it.product) || null,
      unit_price: getEffectivePrice(it.product),
      qty: it.qty,
    }));

    const { data: insertedItems, error: itemsErr } = await supabase
      .from("order_items")
      .insert(itemRows)
      .select();
    if (itemsErr) throw itemsErr;

    const order = mapOrder(orderRow, insertedItems);
    setOrders((prev) => [order, ...prev]);
    return order;
  }

  // Người mua tự huỷ đơn khi đơn còn "đang xử lý" (chưa xác nhận đã nhận
  // hàng). Điều kiện .eq("status", "processing") chặn huỷ đơn đã hoàn tất.
  async function cancelOrder(orderId) {
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId)
      .eq("status", "processing");
    if (error) throw error;
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o))
    );
  }

  // Người mua tự xác nhận đã nhận được hàng -> chuyển đơn sang "đã giao".
  // Bản demo không có luồng người bán xác nhận giao hàng, nên để người mua
  // tự xác nhận là cách hợp lý nhất để mục "Đơn đã giao" có dữ liệu thật.
  async function completeOrder(orderId) {
    const { error } = await supabase
      .from("orders")
      .update({ status: "completed" })
      .eq("id", orderId)
      .eq("status", "processing");
    if (error) throw error;
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "completed" } : o))
    );
  }

  return (
    <OrdersContext.Provider
      value={{ orders, hydrated, loadError, placeOrder, cancelOrder, completeOrder }}
    >
      {children}
    </OrdersContext.Provider>
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
        <OrdersProvider>
          <CartProvider>{children}</CartProvider>
        </OrdersProvider>
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

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within Providers");
  return ctx;
}
