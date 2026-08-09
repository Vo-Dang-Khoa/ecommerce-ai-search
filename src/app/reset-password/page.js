"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../providers";

// Trang người dùng đến sau khi bấm link "đặt lại mật khẩu" trong email
// (gửi từ resetPasswordForEmail() ở providers.js). Supabase Auth tự đăng
// nhập tạm bằng token trong link đó (phiên "recovery") ngay khi trang này
// tải xong — AuthProvider (dùng chung toàn app) sẽ tự nhận ra phiên này và
// set `user`, không cần code riêng ở đây để xử lý token.
function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const { user, hydrated, updatePassword, logout } = useAuth();

  // role kèm theo link trong email (xem resetPasswordForEmail) — chỉ để
  // biết đưa người dùng quay lại đúng bảng đăng nhập Người mua/Người bán
  // sau khi đổi mật khẩu xong.
  const role = searchParams.get("role") === "seller" ? "seller" : "buyer";
  const roleLabel = role === "seller" ? "Người bán" : "Người mua";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
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
      await updatePassword(password);
      // Đăng xuất khỏi phiên "recovery" ngay sau khi đổi mật khẩu thành
      // công, để lần đăng nhập tiếp theo đi qua đúng luồng signIn() (thiết
      // lập active_role/vai trò cho đúng) thay vì giữ nguyên phiên tạm này.
      await logout();
      setDone(true);
    } catch (err) {
      setError(err.message || "Đặt lại mật khẩu thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return <main className="flex-1 bg-amber-50" />;
  }

  if (done) {
    return (
      <main className="flex-1 bg-amber-50">
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-8 py-10">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Đã đặt lại mật khẩu</h1>
            <p className="text-sm text-gray-600 mb-6">
              Mật khẩu của bạn đã được cập nhật. Vui lòng đăng nhập lại bằng mật khẩu mới.
            </p>
            <Link
              href={`/login?role=${role}`}
              className="bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors inline-block"
            >
              Đến trang đăng nhập
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Chưa có phiên "recovery" hợp lệ — link sai, đã dùng rồi, hoặc đã hết
  // hạn (mặc định 1 giờ, tuỳ cấu hình project Supabase).
  if (!user) {
    return (
      <main className="flex-1 bg-amber-50">
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-8 py-10">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Link không hợp lệ hoặc đã hết hạn
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              Vui lòng quay lại trang đăng nhập, bấm &quot;Quên mật khẩu?&quot; và gửi lại email
              đặt lại mật khẩu mới.
            </p>
            <Link
              href={`/login?role=${role}`}
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
            Đặt lại mật khẩu {roleLabel}
          </h1>
          <p className="text-sm text-gray-500 text-center mb-8">
            Nhập mật khẩu mới cho tài khoản <strong>{user.email}</strong>.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Mật khẩu mới</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="bg-gray-900 text-white py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Đang lưu..." : "Đặt lại mật khẩu"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="flex-1 bg-amber-50" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
