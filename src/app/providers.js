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

// Đọc role/is_seller/active_role của 1 tài khoản — CHỊU ĐƯỢC trường hợp
// project chưa chạy supabase/schema.sql bản mới nhất (chưa có cột
// is_seller/active_role, thêm ở v6): tự động thử lại chỉ với cột `role` cũ,
// suy ra is_seller từ role === 'seller', active_role = null (bỏ qua kiểm
// tra đăng nhập song song 2 vai trò cho tới khi chạy SQL cập nhật). Nhờ vậy
// đăng nhập (kể cả bên Người bán) và khôi phục phiên đăng nhập vẫn hoạt
// động bình thường ngay cả khi chưa chạy SQL — chỉ tính năng "chặn đăng
// nhập song song" là cần SQL mới để bật.
async function fetchProfileRow(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, email, phone, address, is_seller, active_role")
    .eq("id", userId)
    .maybeSingle();
  if (!error) return { ...data, schemaReady: true };

  console.warn(
    "[AuthProvider] Chưa có cột is_seller/active_role trong bảng profiles " +
      "(có thể project chưa chạy supabase/schema.sql bản mới nhất) — tạm dùng cột role cũ:",
    error
  );
  const { data: legacy, error: legacyError } = await supabase
    .from("profiles")
    .select("role, email, phone, address")
    .eq("id", userId)
    .maybeSingle();
  if (legacyError) throw legacyError;
  return {
    ...legacy,
    is_seller: legacy?.role === "seller",
    active_role: null,
    schemaReady: false,
  };
}

// Ghi is_seller/active_role — KHÔNG throw nếu lỗi (vd: cột chưa tồn tại vì
// chưa chạy schema.sql bản mới), chỉ cảnh báo ra console. Đây chỉ là dữ
// liệu hỗ trợ chặn đăng nhập song song 2 vai trò, không phải điều kiện bắt
// buộc để đăng nhập/đăng ký thành công — giống cách updateProfile ở
// /checkout không chặn việc đặt hàng khi Supabase lưu thất bại.
async function writeProfileRole(userId, patch) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) {
    console.warn("[AuthProvider] Không lưu được is_seller/active_role:", error);
    return false;
  }
  return true;
}

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
      try {
        const data = await fetchProfileRow(userId);
        if (cancelled) return;
        setProfile(data);
      } catch (error) {
        if (cancelled) return;
        console.error("[AuthProvider] Không tải được profile:", error);
        setProfile(null);
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

  // Hỏi xác nhận trước khi ghi đè active_role của tài khoản (vd: đang đăng
  // nhập Người mua, giờ đăng nhập Người bán) — trả về true nếu người dùng
  // đồng ý đăng xuất vai trò còn lại để tiếp tục, false nếu huỷ.
  function confirmRoleSwitch(currentActiveRole, wantRole) {
    const otherLabel = currentActiveRole === "seller" ? "Người bán" : "Người mua";
    const wantLabel = wantRole === "seller" ? "Người bán" : "Người mua";
    if (typeof window === "undefined") return true;
    return window.confirm(
      `Tài khoản này đang đăng nhập ở vai trò ${otherLabel} (có thể ở tab/thiết bị khác). ` +
        `Bạn có muốn đăng xuất vai trò ${otherLabel} để đăng nhập vai trò ${wantLabel} không?\n\n` +
        `Chọn OK để tiếp tục đăng nhập ${wantLabel}, Huỷ để dừng lại.`
    );
  }

  // role: "buyer" | "seller" — MỖI EMAIL CHỈ ĐĂNG KÝ ĐƯỢC 1 VAI TRÒ DUY
  // NHẤT (Người mua HOẶC Người bán, không dùng chung cho cả 2). Muốn có cả
  // 2 vai trò thì phải dùng 2 email khác nhau. is_seller/active_role vẫn
  // giữ lại trong bảng profiles để tương thích với các tài khoản đã gộp vai
  // trò từ TRƯỚC khi quy tắc này áp dụng, và signIn() vẫn dùng active_role
  // để chặn 1 tài khoản đăng nhập nhiều nơi cùng lúc (xem confirmRoleSwitch).
  async function signUp({ email, password, role }) {
    const wantRole = role === "seller" ? "seller" : "buyer";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: wantRole } },
    });

    // Supabase Auth báo "email đã tồn tại" theo 2 kiểu tuỳ cấu hình project:
    //  1. Trả lỗi rõ ràng ("User already registered").
    //  2. (Phổ biến khi bật "Confirm email", để chống dò xem email nào đã
    //     đăng ký) TRẢ VỀ THÀNH CÔNG GIẢ: có data.user nhưng
    //     data.user.identities là MẢNG RỖNG, không có session — trông y hệt
    //     "tài khoản mới, cần xác nhận email" NHƯNG THỰC RA KHÔNG GỬI EMAIL
    //     NÀO CẢ. Phải nhận diện cả 2 kiểu thì mới báo đúng cho người dùng
    //     thay vì để họ "kẹt" ở màn hình chờ email không bao giờ tới.
    const alreadyRegistered =
      (error &&
        (error.message?.includes("already registered") ||
          error.message?.includes("already been registered"))) ||
      (!error &&
        data?.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0);

    if (alreadyRegistered) {
      throw new Error("Email đã tồn tại, đã được đăng ký trong hệ thống rồi!");
    }

    if (error) throw error;

    // Nếu project bật "Confirm email", data.session sẽ là null cho tới khi
    // người dùng bấm link xác nhận trong hộp thư — trang /register cần biết
    // điều này để hiện thông báo phù hợp thay vì điều hướng ngay. Chưa có
    // session thì cũng chưa có gì để đánh dấu active_role. Tới đây chắc
    // chắn là tài khoản MỚI (không phải case "đã tồn tại" ở trên) nên
    // Supabase sẽ thật sự gửi email xác nhận.
    if (!data.session) {
      return { needsEmailConfirmation: true };
    }

    // Không chặn đăng ký nếu ghi active_role thất bại (vd: chưa chạy SQL
    // bản mới) — tài khoản vẫn tạo/đăng nhập thành công bình thường.
    await writeProfileRole(data.user.id, { active_role: wantRole });
    return { needsEmailConfirmation: false };
  }

  async function signIn({ email, password, role }) {
    const wantRole = role === "seller" ? "seller" : "buyer";
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const userId = data.user.id;
    // fetchProfileRow tự chịu được thiếu cột is_seller/active_role (chưa
    // chạy schema.sql bản mới) — đăng nhập Người bán vẫn hoạt động, dựa
    // theo cột role cũ, chỉ tạm bỏ qua kiểm tra "đăng nhập song song".
    const profileData = await fetchProfileRow(userId);

    if (wantRole === "seller" && !profileData.is_seller) {
      await supabase.auth.signOut();
      throw new Error(
        "Tài khoản này chưa đăng ký vai trò Người bán. Vui lòng đăng ký vai trò Người bán trước."
      );
    }

    if (profileData.schemaReady) {
      const currentActive = profileData.active_role || null;
      if (currentActive && currentActive !== wantRole) {
        if (!confirmRoleSwitch(currentActive, wantRole)) {
          await supabase.auth.signOut();
          throw new Error("Đã huỷ đăng nhập.");
        }
      }
      await writeProfileRole(userId, { active_role: wantRole });
    }

    // Trả về role ngay lập tức (thay vì chờ onAuthStateChange cập nhật state
    // bất đồng bộ) để nơi gọi signIn() biết ngay nên điều hướng tới đâu
    // (vd: /seller nếu là Người bán).
    return { role: wantRole };
  }

  // Đăng xuất: giải phóng active_role để tài khoản có thể đăng nhập lại ở
  // vai trò còn lại (từ tab/thiết bị khác) mà không bị hỏi xác nhận. Không
  // chặn đăng xuất nếu ghi thất bại (vd: chưa chạy schema.sql bản mới).
  async function logout() {
    if (session?.user) {
      await writeProfileRole(session.user.id, { active_role: null });
    }
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

  // Quên mật khẩu (Người mua lẫn Người bán, dùng chung 1 form — xem
  // QuickLoginForm.js): gửi email chứa link đặt lại mật khẩu tới địa chỉ đã
  // đăng ký. Link trỏ về /reset-password?role=... (kèm sẵn vai trò đang
  // đăng nhập để trang đó biết điều hướng đúng chỗ sau khi đổi xong).
  // Supabase Auth luôn trả về thành công dù email có tồn tại hay không (để
  // tránh lộ thông tin email nào đã đăng ký).
  async function resetPasswordForEmail(email, role) {
    const wantRole = role === "seller" ? "seller" : "buyer";
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password?role=${wantRole}`
        : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  // Đặt mật khẩu mới — gọi từ trang /reset-password, lúc đó Supabase Auth
  // đã tự đăng nhập tạm (phiên "recovery") nhờ link trong email, nên chỉ
  // cần updateUser({ password }) là đổi được, không cần biết mật khẩu cũ.
  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        // Vai trò ĐANG đăng nhập của phiên này — ưu tiên active_role (đặt
        // lúc đăng nhập/đăng ký, xem signIn()/signUp() ở trên), fallback về
        // role (vai trò đăng ký đầu tiên) cho các phiên cũ trước khi có
        // active_role, cuối cùng mặc định "buyer".
        role: profile?.active_role ?? profile?.role ?? "buyer",
        // Tài khoản đã từng được cấp vai trò Người bán chưa (dùng để hiện
        // gợi ý "đăng nhập bên Người bán" mà không cần đăng ký lại).
        isSeller: !!profile?.is_seller,
        phone: profile?.phone ?? "",
        address: profile?.address ?? "",
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        signUp,
        signIn,
        logout,
        updateProfile,
        updateEmail,
        resetPasswordForEmail,
        updatePassword,
        hydrated,
      }}
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
    // Thuộc tính sản phẩm (VD: Trọng lượng, Xuất xứ...), mảng { key, value }.
    attributes: row.attributes || [],
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
    if (patch.attributes !== undefined) dbPatch.attributes = patch.attributes;

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

  // Thuộc tính sản phẩm (VD: Trọng lượng: 500g, Xuất xứ: Việt Nam...), nhập
  // ở trang chỉnh sửa sản phẩm. attributes: mảng { key, value }.
  async function setAttributes(productId, attributes) {
    await updateProduct(productId, { attributes });
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
        setAttributes,
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
  // myShop?.id (chuỗi ổn định) dùng làm dependency của effect tải đơn hàng
  // người bán bên dưới — KHÔNG dùng myShopProducts vì mảng đó được tính lại
  // (filter) ở mỗi lần render, sẽ khiến effect chạy lặp lại không cần thiết.
  const { myShop } = useShop();
  const [orders, setOrders] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [sellerOrders, setSellerOrders] = useState([]);
  const [sellerOrdersHydrated, setSellerOrdersHydrated] = useState(false);
  const [sellerOrdersError, setSellerOrdersError] = useState("");

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

  // Đơn hàng có chứa sản phẩm của gian hàng mình — Người bán xem ở trang
  // /seller, mục "Đơn chờ xử lý" / "Đơn đang giao" / "Đơn đã giao" / "Đơn
  // đã huỷ". Truy vấn 3 bước: sản phẩm của gian hàng mình -> order_items
  // chứa các sản phẩm đó -> orders tương ứng. Mỗi đơn chỉ hiển thị các mục
  // hàng thuộc gian hàng mình (order có thể có thêm sản phẩm của gian hàng
  // khác).
  useEffect(() => {
    let cancelled = false;

    async function loadSellerOrders() {
      if (!myShop?.id) {
        setSellerOrders([]);
        setSellerOrdersError("");
        setSellerOrdersHydrated(true);
        return;
      }
      try {
        const { data: productRows, error: productsErr } = await supabase
          .from("products")
          .select("id")
          .eq("shop_id", myShop.id);
        if (productsErr) throw productsErr;

        const productIds = (productRows || []).map((p) => String(p.id));
        if (productIds.length === 0) {
          if (!cancelled) {
            setSellerOrders([]);
            setSellerOrdersError("");
          }
          return;
        }

        const { data: itemRows, error: itemsErr } = await supabase
          .from("order_items")
          .select("*")
          .in("product_id", productIds);
        if (itemsErr) throw itemsErr;

        const orderIds = [...new Set((itemRows || []).map((it) => it.order_id))];
        let orderRows = [];
        if (orderIds.length > 0) {
          const { data, error: ordersErr } = await supabase
            .from("orders")
            .select("*")
            .in("id", orderIds)
            .order("created_at", { ascending: false });
          if (ordersErr) throw ordersErr;
          orderRows = data || [];
        }
        if (cancelled) return;

        setSellerOrders(
          orderRows.map((row) =>
            mapOrder(
              row,
              (itemRows || []).filter((it) => it.order_id === row.id)
            )
          )
        );
        setSellerOrdersError("");
      } catch (err) {
        if (!cancelled) {
          console.error("[OrdersProvider] Không tải được đơn hàng của gian hàng:", err);
          setSellerOrdersError(
            "Không tải được đơn hàng của gian hàng từ Supabase. Có thể project chưa chạy " +
              "supabase/schema.sql (bản mới nhất) để tạo policy cho phép Người bán xem đơn hàng."
          );
        }
      } finally {
        if (!cancelled) setSellerOrdersHydrated(true);
      }
    }

    setSellerOrdersHydrated(false);
    loadSellerOrders();
    return () => {
      cancelled = true;
    };
  }, [myShop?.id]);

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
  // Chỉ xác nhận được khi đơn đang ở trạng thái "shipping" (Người bán đã
  // bấm "Bắt đầu giao hàng" ở trang /seller) — .eq("status", "shipping")
  // chặn xác nhận đơn còn "chờ xử lý" (chưa được giao) hoặc đã hoàn tất.
  async function completeOrder(orderId) {
    const { error } = await supabase
      .from("orders")
      .update({ status: "completed" })
      .eq("id", orderId)
      .eq("status", "shipping");
    if (error) throw error;
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "completed" } : o))
    );
  }

  // Người bán bấm "Bắt đầu giao hàng" ở trang /seller -> chuyển đơn từ
  // "chờ xử lý" sang "đang giao". Cập nhật cả sellerOrders (danh sách đơn
  // của gian hàng) lẫn orders (phòng trường hợp người bán tự mua sản phẩm
  // của mình, đơn đó cũng nằm trong lịch sử mua hàng của họ ở /account).
  async function shipOrder(orderId) {
    const { error } = await supabase
      .from("orders")
      .update({ status: "shipping" })
      .eq("id", orderId)
      .eq("status", "processing");
    if (error) throw error;
    setSellerOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "shipping" } : o))
    );
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "shipping" } : o))
    );
  }

  return (
    <OrdersContext.Provider
      value={{
        orders,
        hydrated,
        loadError,
        placeOrder,
        cancelOrder,
        completeOrder,
        sellerOrders,
        sellerOrdersHydrated,
        sellerOrdersError,
        shipOrder,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

function CartProvider({ children }) {
  const { allProducts } = useShop();
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  // "Mua ngay": chỉ giữ tạm 1 sản phẩm + số lượng trong state (KHÔNG lưu
  // localStorage, KHÔNG đụng tới giỏ hàng thật) để trang /checkout đặt hàng
  // đúng 1 sản phẩm này, không lẫn với các sản phẩm khác đang có trong giỏ.
  const [buyNowItem, setBuyNowItem] = useState(null);

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

  // Gọi từ nút "Mua ngay" ở ProductCard/quick-view — KHÔNG thêm vào giỏ
  // hàng thật, chỉ ghi nhớ tạm 1 sản phẩm để /checkout dùng riêng.
  function buyNow(id, qty = 1) {
    setBuyNowItem({ id, qty });
  }

  // Xoá "Mua ngay" sau khi đặt hàng xong (hoặc khi người dùng rời trang
  // /checkout mà không xác nhận), tránh lần "Mua ngay" sau bị lẫn dữ liệu cũ.
  function clearBuyNow() {
    setBuyNowItem(null);
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

  // Sản phẩm "Mua ngay" kèm đầy đủ thông tin product (giống detailedItems ở
  // trên) để /checkout hiển thị và tính tiền — null nếu chưa bấm "Mua ngay",
  // hoặc nếu sản phẩm đó không còn tồn tại (vd: người bán đã xoá).
  const buyNowDetailedItem = buyNowItem
    ? (() => {
        const product = allProducts.find((p) => p.id === buyNowItem.id);
        return product ? { ...buyNowItem, product } : null;
      })()
    : null;

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
        buyNowItem: buyNowDetailedItem,
        buyNow,
        clearBuyNow,
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
