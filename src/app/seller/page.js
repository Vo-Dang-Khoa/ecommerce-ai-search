"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, useShop, useOrders } from "../providers";
import { getEffectivePrice, getProductImage } from "@/lib/shops";
import { paymentMethodLabel, shippingMethodLabel } from "@/lib/orderOptions";
import BannerManager from "./BannerManager";

// "Người bán" trong header dẫn tới đây — mục "Tài khoản người bán" là gian
// hàng/sản phẩm (nội dung cũ của trang), 4 mục còn lại là đơn hàng có chứa
// sản phẩm của gian hàng mình. Luồng trạng thái đơn: "Đơn chờ xử lý"
// (processing, mới đặt) -> Người bán bấm "Bắt đầu giao hàng" -> "Đơn đang
// giao" (shipping) -> Người mua tự xác nhận đã nhận hàng ở trang /account
// -> "Đơn đã giao" (completed); hoặc Người mua huỷ trong lúc còn "chờ xử
// lý" -> "Đơn đã huỷ" (cancelled).
const SELLER_TABS = [
  { key: "shop", label: "Tài khoản người bán" },
  { key: "processing", label: "Đơn chờ xử lý" },
  { key: "shipping", label: "Đơn đang giao" },
  { key: "completed", label: "Đơn đã giao" },
  { key: "cancelled", label: "Đơn đã huỷ" },
];

function RegisterShopForm() {
  const { registerShop } = useShop();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (name.trim().length < 3) {
      setError("Tên gian hàng phải có ít nhất 3 ký tự.");
      return;
    }
    setError("");
    try {
      await registerShop({ name: name.trim(), phone: phone.trim(), description: description.trim() });
    } catch (err) {
      setError(err.message || "Đăng ký gian hàng thất bại, vui lòng thử lại.");
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-8 py-10">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Đăng ký gian hàng
        </h1>
        <p className="text-sm text-gray-500 text-center mb-8">
          Mở gian hàng để bắt đầu đăng bán sản phẩm trên ShopAI.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Tên gian hàng
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tiệm bánh của tôi"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Số điện thoại
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Giới thiệu gian hàng
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Chuyên bánh sinh nhật, bánh ngọt theo yêu cầu..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            className="bg-gray-900 text-white py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors mt-2"
          >
            Đăng ký gian hàng
          </button>
        </form>
      </div>
    </div>
  );
}

function ShopInfoCard({ shop }) {
  const { updateShop } = useShop();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(shop.name);
  const [phone, setPhone] = useState(shop.phone);
  const [description, setDescription] = useState(shop.description);
  const [error, setError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    try {
      await updateShop({ name: name.trim(), phone: phone.trim(), description: description.trim() });
      setEditing(false);
    } catch (err) {
      setError(err.message || "Cập nhật gian hàng thất bại, vui lòng thử lại.");
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="border border-gray-200 rounded-xl p-6 flex flex-col gap-3 mb-8"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900 resize-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800"
          >
            Lưu
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-gray-600 px-4 py-2 hover:text-gray-900"
          >
            Huỷ
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-gray-900">{shop.name}</h2>
        {shop.phone && <p className="text-sm text-gray-500 mt-1">📞 {shop.phone}</p>}
        {shop.description && (
          <p className="text-sm text-gray-600 mt-2">{shop.description}</p>
        )}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="self-start shrink-0 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md px-3 py-1.5"
      >
        Sửa thông tin
      </button>
    </div>
  );
}

function ProductRow({ product }) {
  const { removeProduct } = useShop();
  const image = getProductImage(product);
  const effectivePrice = getEffectivePrice(product);
  const onSale = effectivePrice < product.price;

  async function handleDelete() {
    if (confirm(`Xoá sản phẩm "${product.name}"?`)) {
      try {
        await removeProduct(product.id);
      } catch (err) {
        alert(err.message || "Xoá sản phẩm thất bại, vui lòng thử lại.");
      }
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URLs/arbitrary URLs
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-14 h-14 object-cover rounded-md bg-amber-50 shrink-0"
          />
        ) : (
          <span className="text-3xl w-14 text-center shrink-0">🧁</span>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
          <p className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 w-fit mt-1">
            {product.category}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4">
        <div className="text-left sm:text-right shrink-0">
          {onSale && (
            <p className="text-xs text-gray-400 line-through">
              {product.price.toLocaleString("vi-VN")}đ
            </p>
          )}
          <p className="font-semibold text-gray-900">
            {effectivePrice.toLocaleString("vi-VN")}đ
          </p>
          {onSale && (
            <p className="text-xs text-red-600">-{product.promotion.percent}% khuyến mãi</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <Link
            href={`/seller/products/${product.id}`}
            className="text-sm text-center bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800"
          >
            Quản lý
          </Link>
          <button
            onClick={handleDelete}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Xoá
          </button>
        </div>
      </div>
    </div>
  );
}

// Nội dung tab "Tài khoản người bán": thông tin gian hàng + danh sách sản
// phẩm (đăng bán, sửa giá, khuyến mãi, thuộc tính ở trang chi tiết sản phẩm).
function ShopContent({ shop }) {
  const { myShopProducts } = useShop();

  return (
    <>
      <ShopInfoCard shop={shop} />

      <BannerManager shop={shop} />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          Sản phẩm ({myShopProducts.length})
        </h2>
        <Link
          href="/seller/products/new"
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800"
        >
          + Thêm sản phẩm
        </Link>
      </div>

      {myShopProducts.length === 0 ? (
        <p className="text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-xl">
          Gian hàng chưa có sản phẩm nào. Hãy thêm sản phẩm đầu tiên.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {myShopProducts.map((product) => (
            <ProductRow key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}

// Đơn hàng dành cho Người bán — chỉ hiện các mục hàng thuộc gian hàng của
// mình (order.items đã được lọc sẵn từ OrdersProvider), và tổng tiền tính
// riêng cho phần sản phẩm của gian hàng mình (đơn có thể còn chứa sản phẩm
// của gian hàng khác). Khi đơn đang "chờ xử lý", Người bán bấm "Bắt đầu
// giao hàng" để chuyển sang "đang giao" — các bước sau đó (xác nhận đã
// nhận hàng / huỷ) do Người mua tự thực hiện ở trang /account.
function SellerOrderCard({ order }) {
  const { shipOrder } = useOrders();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const createdLabel = order.createdAt
    ? new Date(order.createdAt).toLocaleString("vi-VN")
    : "";
  const shopSubtotal = order.items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);

  async function handleShip() {
    setError("");
    setBusy(true);
    try {
      await shipOrder(order.id);
    } catch (err) {
      setError(err?.message || "Cập nhật thất bại, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-xs text-gray-500">
          Mã đơn: <span className="font-mono">{order.id.slice(0, 8)}</span>
          {createdLabel && <> · {createdLabel}</>}
        </p>
        <span className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
          {paymentMethodLabel(order.paymentMethod)} · {shippingMethodLabel(order.shippingMethod)}
        </span>
      </div>

      <div className="flex flex-col gap-2 mb-3">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- ảnh snapshot lúc đặt hàng
              <img
                src={item.image}
                alt={item.name}
                loading="lazy"
                decoding="async"
                className="w-10 h-10 object-cover rounded-md bg-amber-50 shrink-0"
              />
            ) : (
              <span className="text-2xl shrink-0">🧁</span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 truncate">{item.name}</p>
              <p className="text-xs text-gray-500">
                {item.qty} x {item.unitPrice.toLocaleString("vi-VN")}đ
              </p>
            </div>
            <span className="text-sm font-medium text-gray-900 shrink-0">
              {(item.unitPrice * item.qty).toLocaleString("vi-VN")}đ
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
        <p className="text-gray-500">
          Giao tới: {order.address || "—"} · SĐT: {order.phone || "—"}
        </p>
        <p className="font-semibold text-gray-900">
          Tổng (sản phẩm của gian hàng bạn): {shopSubtotal.toLocaleString("vi-VN")}đ
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {order.status === "processing" && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleShip}
            disabled={busy}
            className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Bắt đầu giao hàng
          </button>
        </div>
      )}
    </div>
  );
}

function SellerOrdersTab({ status }) {
  const { sellerOrders, sellerOrdersHydrated, sellerOrdersError } = useOrders();

  if (!sellerOrdersHydrated) return null;

  if (sellerOrdersError) {
    return (
      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
        {sellerOrdersError}
      </p>
    );
  }

  const filtered = sellerOrders.filter((o) => o.status === status);

  if (filtered.length === 0) {
    const emptyText =
      status === "processing"
        ? "Chưa có đơn hàng nào chờ xử lý."
        : status === "shipping"
        ? "Chưa có đơn hàng nào đang giao."
        : status === "completed"
        ? "Chưa có đơn hàng nào đã giao."
        : "Chưa có đơn hàng nào bị huỷ.";
    return (
      <p className="text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-xl bg-white">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {filtered.map((order) => (
        <SellerOrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

function SellerPageInner() {
  const searchParams = useSearchParams();
  const { user, hydrated: authHydrated } = useAuth();
  const { myShop, hydrated: shopHydrated, loadError } = useShop();

  const rawTab = searchParams.get("tab");
  const tab = SELLER_TABS.some((t) => t.key === rawTab) ? rawTab : "shop";

  if (!authHydrated || !shopHydrated) return null;

  if (!user) {
    return (
      <main className="flex-1 bg-amber-50">
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <p className="text-gray-600 mb-6">
            Bạn cần đăng nhập để đăng ký và quản lý gian hàng.
          </p>
          <Link
            href="/login"
            className="bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
          >
            Đăng nhập
          </Link>
        </div>
      </main>
    );
  }

  if (user.role !== "seller") {
    // isSeller: tài khoản (email) này đã từng được cấp vai trò Người bán
    // chưa (chỉ còn đúng với các tài khoản đã gộp vai trò TRƯỚC KHI tính
    // năng đó bị bỏ) — nếu rồi thì chỉ cần đăng nhập lại ở vai trò Người
    // bán. Mỗi email giờ chỉ đăng ký được 1 vai trò duy nhất, nên tài khoản
    // Người mua bình thường phải dùng MỘT EMAIL KHÁC để đăng ký Người bán.
    return (
      <main className="flex-1 bg-amber-50">
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <p className="text-gray-600 mb-6">
            Tài khoản {user.email} đang đăng nhập ở vai trò <strong>Người mua</strong>, không
            thể truy cập kênh người bán.{" "}
            {user.isSeller
              ? "Tài khoản này cũng có vai trò Người bán — hãy đăng nhập lại ở vai trò Người bán để tiếp tục."
              : "Hãy đăng ký một tài khoản khác (email khác) với vai trò Người bán nếu bạn muốn mở gian hàng."}
          </p>
          <Link
            href={user.isSeller ? "/login?role=seller" : "/register?role=seller"}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
          >
            {user.isSeller ? "Đăng nhập vai trò Người bán" : "Đăng ký vai trò Người bán"}
          </Link>
        </div>
      </main>
    );
  }

  if (!myShop) {
    return (
      <main className="flex-1 bg-amber-50">
        {loadError && (
          <div className="max-w-md mx-auto px-4 pt-6">
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
              {loadError}
            </p>
          </div>
        )}
        <RegisterShopForm />
      </main>
    );
  }

  return (
    <main className="flex-1 bg-amber-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-bold text-gray-900">Kênh người bán</h1>
          <Link
            href="/account"
            className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md px-3 py-1.5"
          >
            Tài khoản của tôi
          </Link>
        </div>
        <p className="text-sm text-gray-500 mb-1">
          Đăng nhập với email: <span className="text-gray-700">{user.email}</span>{" "}
          <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
            Người bán
          </span>
        </p>
        <p className="text-sm text-gray-500 mb-6">Gian hàng: {myShop.name}</p>

        {loadError && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3 mb-6">
            {loadError}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-8">
          {SELLER_TABS.map((t) => (
            <Link
              key={t.key}
              href={`/seller?tab=${t.key}`}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                tab === t.key
                  ? "bg-gray-900 text-white border-gray-900"
                  : "border-gray-300 text-gray-700 hover:border-gray-900"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {tab === "shop" ? <ShopContent shop={myShop} /> : <SellerOrdersTab status={tab} />}
      </div>
    </main>
  );
}

export default function SellerPage() {
  return (
    <Suspense fallback={<main className="flex-1 bg-amber-50" />}>
      <SellerPageInner />
    </Suspense>
  );
}
