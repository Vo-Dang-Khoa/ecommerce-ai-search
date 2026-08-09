"use client";

import { useState } from "react";
import { useAuth } from "../providers";

function mapAuthError(err) {
  const msg = err?.message || "";
  if (msg.includes("Invalid login credentials")) {
    return "Email hoặc mật khẩu không đúng.";
  }
  if (msg.includes("Email not confirmed")) {
    return "Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.";
  }
  return msg || "Đăng nhập thất bại, vui lòng thử lại.";
}

/**
 * Form đăng nhập (email + mật khẩu) dùng chung cho:
 *   - AuthDropdown.js (bảng nổi ở header)
 *   - register/page.js (bảng "... đăng nhập" thay thế bảng "... đăng ký")
 * Không tự điều hướng — sau khi đăng nhập thành công sẽ gọi onSuccess(role)
 * để nơi gọi tự quyết định làm gì tiếp theo (đóng dropdown, chuyển trang...).
 */
export default function QuickLoginForm({ onSuccess }) {
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
      const { role } = await signIn({ email, password });
      setEmail("");
      setPassword("");
      onSuccess?.(role);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mật khẩu"
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-gray-900 text-white py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
