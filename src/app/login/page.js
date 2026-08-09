"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers";

function mapAuthError(err) {
  const msg = err?.message || "";
  if (msg.includes("Invalid login credentials")) {
    return "Email hoặc mật khẩu không đúng.";
  }
  if (msg.includes("Email not confirmed")) {
    return "Email chưa được xác nhận. Vui lòng kiểm tra hộp thư để xác nhận tài khoản trước.";
  }
  return msg || "Đăng nhập thất bại, vui lòng thử lại.";
}

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn({ email, password });
      router.push("/");
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 bg-amber-50">
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-8 py-10">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Đăng nhập
          </h1>
          <p className="text-sm text-gray-500 text-center mb-8">
            Đăng nhập bằng tài khoản ShopAI của bạn.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@example.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="bg-gray-900 text-white py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          <p className="text-sm text-gray-500 text-center mt-6">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="text-gray-900 font-medium hover:underline">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
