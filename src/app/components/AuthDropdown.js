"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
 * Nút mở dropdown đăng nhập nhanh ngay trong header, bên dưới có link đăng
 * ký. Dùng chung cho cả 2 lối vào:
 *   - "Người bán" (bên trái header) — registerRole="seller"
 *   - "Đăng nhập" của người mua (bên phải header) — registerRole="buyer"
 * Sau khi đăng nhập thành công, nếu tài khoản có role "seller" sẽ tự điều
 * hướng sang /seller; ngược lại chỉ đóng dropdown lại (ở nguyên trang).
 */
export default function AuthDropdown({ triggerLabel, registerRole }) {
  const router = useRouter();
  const { signIn } = useAuth();
  const containerRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggleOpen() {
    setError("");
    setOpen((v) => !v);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { role } = await signIn({ email, password });
      setOpen(false);
      setEmail("");
      setPassword("");
      if (role === "seller") {
        router.push("/seller");
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button type="button" onClick={toggleOpen} className="hover:text-gray-900">
        {triggerLabel}
      </button>

      {open && (
        <div className="absolute top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-5 z-50 text-left">
          <p className="text-sm font-semibold text-gray-900 mb-3">
            {registerRole === "seller" ? "Người bán đăng nhập" : "Người mua đăng nhập"}
          </p>
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

          <div className="border-t border-gray-100 mt-4 pt-4 text-center">
            <p className="text-xs text-gray-500 mb-2">Chưa có tài khoản?</p>
            <Link
              href={`/register?role=${registerRole}`}
              onClick={() => setOpen(false)}
              className="inline-block w-full text-sm border border-gray-300 rounded-md px-3 py-2 hover:border-gray-900 hover:text-gray-900 transition-colors"
            >
              Đăng ký {registerRole === "seller" ? "Người bán" : "Người mua"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
