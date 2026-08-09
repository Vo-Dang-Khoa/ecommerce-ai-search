"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../providers";

function mapAuthError(err) {
  const msg = err?.message || "";
  if (msg.includes("User already registered")) {
    return "Email này đã được đăng ký. Vui lòng đăng nhập.";
  }
  if (msg.includes("Password should be at least")) {
    return "Mật khẩu phải có ít nhất 6 ký tự.";
  }
  if (msg.includes("Unable to validate email")) {
    return "Email không hợp lệ.";
  }
  return msg || "Đăng ký thất bại, vui lòng thử lại.";
}

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp } = useAuth();

  // Vai trò được quyết định hoàn toàn bởi lối vào (?role=seller hay
  // ?role=buyer, truyền từ dropdown "Người bán" / "Đăng nhập" trong
  // Header.js) — không cho người dùng tự chọn lại trên trang này nữa.
  const role = searchParams.get("role") === "seller" ? "seller" : "buyer";
  const roleLabel = role === "seller" ? "Người bán" : "Người mua";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      setError("Email không hợp lệ.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signUp({ email, password, role });
      if (needsEmailConfirmation) {
        setNeedsConfirmation(true);
      } else {
        router.push(role === "seller" ? "/seller" : "/");
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (needsConfirmation) {
    return (
      <main className="flex-1 bg-amber-50">
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-8 py-10">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Kiểm tra email của bạn
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              Chúng tôi đã gửi email xác nhận tới <strong>{email}</strong>. Vui lòng bấm vào
              link trong email để kích hoạt tài khoản, sau đó quay lại đăng nhập.
            </p>
            <Link
              href="/login"
              className="bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors inline-block"
            >
              Đến trang đăng nhập
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-amber-50">
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-8 py-10">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            {roleLabel} đăng ký
          </h1>
          <p className="text-sm text-gray-500 text-center mb-8">
            Tạo tài khoản {roleLabel} mới trên ShopAI.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@example.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Xác nhận mật khẩu</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="bg-gray-900 text-white py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Đang tạo tài khoản..." : "Đăng ký"}
            </button>
          </form>

          <p className="text-sm text-gray-500 text-center mt-6">
            Đã có tài khoản?{" "}
            <Link href="/login" className="text-gray-900 font-medium hover:underline">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="flex-1 bg-amber-50" />}>
      <RegisterPageInner />
    </Suspense>
  );
}
