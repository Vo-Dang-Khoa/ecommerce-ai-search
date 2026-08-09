"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useOrders } from "../providers";
import { readContactCache, writeContactCache } from "@/lib/contactCache";
import { paymentMethodLabel, shippingMethodLabel } from "@/lib/orderOptions";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(0|\+84)[3-9][0-9]{8}$/;

// "Người mua" trong header dẫn tới đây — 4 mục giống nhau cho mọi tài
// khoản đã đăng nhập (Người mua lẫn Người bán đều có thể đặt hàng).
const TABS = [
  { key: "account", label: "Tài khoản người mua" },
  { key: "processing", label: "Đơn đang xử lý" },
  { key: "completed", label: "Đơn đã giao" },
  { key: "cancelled", label: "Đơn đã huỷ" },
];

function mapAuthError(err) {
  const msg = err?.message || "";
  if (msg.includes("already registered") || msg.includes("already been registered")) {
    return "Email này đã được dùng cho một tài khoản khác.";
  }
  if (msg.includes("Unable to validate email")) {
    return "Email không hợp lệ.";
  }
  if (msg.includes("Could not find")) {
    return "Chưa lưu được vào Supabase — project chưa chạy supabase/schema.sql (bản mới nhất) để tạo/cập nhật cột hoặc bảng cần thiết.";
  }
  return msg || "Có lỗi xảy ra, vui lòng thử lại.";
}

function AccountSettings({ user, updateProfile, updateEmail }) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailNotice, setEmailNotice] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [contactError, setContactError] = useState("");
  const [contactSaved, setContactSaved] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  // Điền sẵn dữ liệu hiện có: email từ Supabase Auth, phone/address ưu
  // tiên lấy từ profiles (Supabase), nếu chưa có thì lấy từ cache trong
  // trình duyệt (lưu ở lần đặt hàng/lưu gần nhất, phòng khi Supabase chưa
  // lưu được — vd: chưa chạy schema.sql).
  useEffect(() => {
    const cached = readContactCache();
    setEmail(user.email || "");
    setPhone(user.phone || cached.phone || "");
    setAddress(user.address || cached.address || "");
  }, [user]);

  async function handleSaveEmail(e) {
    e.preventDefault();
    setEmailNotice("");
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError("Email không hợp lệ.");
      return;
    }
    if (trimmed === user.email) {
      setEmailError("Đây đang là email hiện tại của bạn.");
      return;
    }
    setEmailError("");
    setSavingEmail(true);
    try {
      await updateEmail(trimmed);
      setEmailNotice(
        "Đã gửi email xác nhận. Vui lòng bấm vào link xác nhận trong hộp thư (email cũ và/hoặc email mới) để hoàn tất đổi email."
      );
    } catch (err) {
      setEmailError(mapAuthError(err));
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleSaveContact(e) {
    e.preventDefault();
    setContactSaved(false);
    const trimmedPhone = phone.trim();
    if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
      setContactError("Số điện thoại không hợp lệ.");
      return;
    }
    setContactError("");
    setSavingContact(true);

    const contact = { phone: trimmedPhone, address: address.trim() };
    // Luôn lưu tạm vào trình duyệt trước, không phụ thuộc Supabase.
    writeContactCache(contact);

    try {
      await updateProfile(contact);
      setContactSaved(true);
    } catch (err) {
      setContactError(mapAuthError(err));
    } finally {
      setSavingContact(false);
    }
  }

  return (
    <>
      {/* Email đăng nhập */}
      <section className="bg-white rounded-2xl border border-amber-100 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Email đăng nhập
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Dùng để đăng nhập và nhận thông báo từ ShopAI.
        </p>
        <form
          onSubmit={handleSaveEmail}
          className="flex flex-col sm:flex-row gap-3"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            disabled={savingEmail}
            className="shrink-0 bg-gray-900 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingEmail ? "Đang cập nhật..." : "Cập nhật email"}
          </button>
        </form>
        {emailError && <p className="text-sm text-red-600 mt-3">{emailError}</p>}
        {emailNotice && !emailError && (
          <p className="text-sm text-green-700 mt-3">{emailNotice}</p>
        )}
      </section>

      {/* Số điện thoại + địa chỉ giao hàng */}
      <section className="bg-white rounded-2xl border border-amber-100 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Thông tin liên lạc
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Số điện thoại và địa chỉ giao hàng dùng khi đặt hàng — có thể
          chỉnh sửa bất cứ lúc nào.
        </p>
        <form onSubmit={handleSaveContact} className="flex flex-col gap-4">
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
              Địa chỉ giao hàng
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
            />
          </div>

          {contactError && <p className="text-sm text-red-600">{contactError}</p>}
          {contactSaved && !contactError && (
            <p className="text-sm text-green-700">Đã lưu thông tin liên lạc.</p>
          )}

          <button
            type="submit"
            disabled={savingContact}
            className="self-start bg-gray-900 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingContact ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </form>
      </section>

      {/* Người bán: thông tin gian hàng (tên, SĐT liên hệ gian hàng,
          giới thiệu) quản lý riêng ở trang /seller, không lặp lại ở đây. */}
      {user.role === "seller" && (
        <section className="bg-white rounded-2xl border border-amber-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Thông tin gian hàng
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Tên gian hàng, số điện thoại liên hệ và phần giới thiệu được
            quản lý riêng tại trang Kênh người bán.
          </p>
          <Link
            href="/seller"
            className="inline-block text-sm border border-gray-300 rounded-md px-4 py-2 hover:border-gray-900 hover:text-gray-900 transition-colors"
          >
            Đến trang quản lý gian hàng
          </Link>
        </section>
      )}
    </>
  );
}

function OrderCard({ order }) {
  const { cancelOrder, completeOrder } = useOrders();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const createdLabel = order.createdAt
    ? new Date(order.createdAt).toLocaleString("vi-VN")
    : "";

  async function handleCancel() {
    if (!confirm("Huỷ đơn hàng này?")) return;
    setError("");
    setBusy(true);
    try {
      await cancelOrder(order.id);
    } catch (err) {
      setError(err?.message || "Huỷ đơn thất bại, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    setError("");
    setBusy(true);
    try {
      await completeOrder(order.id);
    } catch (err) {
      setError(err?.message || "Xác nhận thất bại, vui lòng thử lại.");
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
          Tổng: {order.total.toLocaleString("vi-VN")}đ
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {order.status === "processing" && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleComplete}
            disabled={busy}
            className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Đã nhận được hàng
          </button>
          <button
            onClick={handleCancel}
            disabled={busy}
            className="text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-md px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Huỷ đơn
          </button>
        </div>
      )}
    </div>
  );
}

function OrdersTab({ status }) {
  const { orders, hydrated, loadError } = useOrders();

  if (!hydrated) return null;

  if (loadError) {
    return (
      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
        {loadError}
      </p>
    );
  }

  const filtered = orders.filter((o) => o.status === status);

  if (filtered.length === 0) {
    const emptyText =
      status === "processing"
        ? "Bạn chưa có đơn hàng nào đang xử lý."
        : status === "completed"
        ? "Bạn chưa có đơn hàng nào đã giao."
        : "Bạn chưa huỷ đơn hàng nào.";
    return (
      <p className="text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-xl bg-white">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {filtered.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

function AccountPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hydrated, updateProfile, updateEmail } = useAuth();

  // Chưa đăng nhập mà vào thẳng /account (gõ URL, back/forward...) -> đưa
  // về trang đăng nhập, đăng nhập xong quay lại đây.
  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login?role=buyer&redirect=/account");
    }
  }, [hydrated, user, router]);

  const rawTab = searchParams.get("tab");
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab : "account";

  if (!hydrated || !user) {
    return <main className="flex-1 bg-white" />;
  }

  return (
    <main className="flex-1 bg-amber-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Người mua</h1>
        <p className="text-sm text-gray-500 mb-6">
          Vai trò tài khoản:{" "}
          <span className="text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
            {user.role === "seller" ? "Người bán" : "Người mua"}
          </span>
        </p>

        <div className="flex flex-wrap gap-2 mb-8">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/account?tab=${t.key}`}
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

        {tab === "account" ? (
          <AccountSettings
            user={user}
            updateProfile={updateProfile}
            updateEmail={updateEmail}
          />
        ) : (
          <OrdersTab status={tab} />
        )}
      </div>
    </main>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<main className="flex-1 bg-amber-50" />}>
      <AccountPageInner />
    </Suspense>
  );
}
