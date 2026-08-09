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
  if (msg.includes("Unable to validate email")) {
    return "Email không hợp lệ.";
  }
  return msg || "Đăng nhập thất bại, vui lòng thử lại.";
}

/**
 * Form đăng nhập (email + mật khẩu) dùng chung cho:
 *   - AuthDropdown.js (bảng nổi ở header)
 *   - login/page.js, register/page.js (bảng "... đăng nhập")
 * `role` ("buyer"/"seller"): vai trò muốn đăng nhập vào — 1 email có thể có
 * cả 2 vai trò nhưng chỉ đăng nhập được 1 bên tại 1 thời điểm; nếu bên còn
 * lại đang hoạt động, signIn() sẽ tự hỏi xác nhận trước khi ghi đè.
 * Không tự điều hướng — sau khi đăng nhập thành công sẽ gọi onSuccess(role)
 * để nơi gọi tự quyết định làm gì tiếp theo (đóng dropdown, chuyển trang...).
 *
 * Có thêm "Quên mật khẩu?" ngay trong form này (chuyển sang mode "forgot")
 * — dùng chung cho cả 2 lối vào Người mua/Người bán vì `role` đã được
 * truyền sẵn, gửi kèm vào link đặt lại mật khẩu trong email.
 */
export default function QuickLoginForm({ onSuccess, role }) {
  const { signIn, resetPasswordForEmail } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "forgot"

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { role: loggedInRole } = await signIn({ email, password, role });
      setEmail("");
      setPassword("");
      onSuccess?.(loggedInRole);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function openForgot() {
    setError("");
    setResetSent(false);
    setMode("forgot");
  }

  function backToLogin() {
    setError("");
    setResetSent(false);
    setMode("login");
  }

  async function handleForgotSubmit(e) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Vui lòng nhập email.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await resetPasswordForEmail(email.trim(), role);
      setResetSent(true);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "forgot") {
    if (resetSent) {
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-green-700">
            Đã gửi email đặt lại mật khẩu tới <strong>{email}</strong>. Vui lòng kiểm tra hộp
            thư (kể cả mục Spam) và bấm vào link trong email để đặt mật khẩu mới.
          </p>
          <button
            type="button"
            onClick={backToLogin}
            className="text-sm text-gray-900 font-medium hover:underline self-start"
          >
            ← Quay lại đăng nhập
          </button>
        </div>
      );
    }

    return (
      <form onSubmit={handleForgotSubmit} className="flex flex-col gap-3">
        <p className="text-xs text-gray-500">
          Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu qua email đó.
        </p>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-gray-900 text-white py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Đang gửi..." : "Gửi email đặt lại mật khẩu"}
        </button>
        <button
          type="button"
          onClick={backToLogin}
          className="text-xs text-gray-500 hover:text-gray-900 self-start"
        >
          ← Quay lại đăng nhập
        </button>
      </form>
    );
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
      <button
        type="button"
        onClick={openForgot}
        className="text-xs text-gray-500 hover:text-gray-900 self-start"
      >
        Quên mật khẩu?
      </button>
    </form>
  );
}
