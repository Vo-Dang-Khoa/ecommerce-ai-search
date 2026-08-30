"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../providers";

// Đăng nhập ADMIN — TÁCH RIÊNG khỏi /login (Người mua/Người bán) vì Admin
// không tham gia cơ chế active_role buyer/seller (xem signInAdmin() trong
// providers.js). App CHƯA có trang đăng ký Admin công khai — muốn có tài
// khoản Admin, tự nâng 1 tài khoản đã đăng ký lên bằng lệnh SQL trong
// supabase/schema.sql (mục 10), rồi đăng nhập lại đúng email đó ở đây.
export default function AdminLoginPage() {
  const router = useRouter();
  const { signInAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signInAdmin({ email: email.trim(), password });
      router.push("/admin");
    } catch (err) {
      setError(err.message || "Đăng nhập thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-10">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Admin đăng nhập</h1>
          <p className="text-sm text-gray-500 text-center mb-8">
            Quản lý khuyến mãi theo ngành hàng của ShopAI.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="bg-gray-900 text-white py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          <p className="text-sm text-gray-500 text-center mt-6">
            Không phải Admin? <Link href="/" className="text-gray-900 font-medium hover:underline">Về trang chủ</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
