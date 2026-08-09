"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers";
import { readContactCache, writeContactCache } from "@/lib/contactCache";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(0|\+84)[3-9][0-9]{8}$/;

function mapAuthError(err) {
  const msg = err?.message || "";
  if (msg.includes("already registered") || msg.includes("already been registered")) {
    return "Email này đã được dùng cho một tài khoản khác.";
  }
  if (msg.includes("Unable to validate email")) {
    return "Email không hợp lệ.";
  }
  if (msg.includes("Could not find")) {
    return "Chưa lưu được vào Supabase — project chưa chạy supabase/schema.sql để thêm cột phone/address vào bảng profiles.";
  }
  return msg || "Có lỗi xảy ra, vui lòng thử lại.";
}

export default function AccountPage() {
  const router = useRouter();
  const { user, hydrated, updateProfile, updateEmail } = useAuth();

  // Người mua/Người bán chưa đăng nhập mà vào thẳng /account (gõ URL,
  // back/forward...) -> đưa về trang đăng nhập, đăng nhập xong quay lại đây.
  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login?role=buyer&redirect=/account");
    }
  }, [hydrated, user, router]);

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
    if (!user) return;
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

  if (!hydrated || !user) {
    return <main className="flex-1 bg-white" />;
  }

  return (
    <main className="flex-1 bg-amber-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          Tài khoản của tôi
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Vai trò:{" "}
          <span className="text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
            {user.role === "seller" ? "Người bán" : "Người mua"}
          </span>
        </p>

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
          {emailError && (
            <p className="text-sm text-red-600 mt-3">{emailError}</p>
          )}
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

            {contactError && (
              <p className="text-sm text-red-600">{contactError}</p>
            )}
            {contactSaved && !contactError && (
              <p className="text-sm text-green-700">
                Đã lưu thông tin liên lạc.
              </p>
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
      </div>
    </main>
  );
}
