"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import QuickLoginForm from "./QuickLoginForm";

/**
 * Nút mở dropdown đăng nhập nhanh ngay trong header, bên dưới có link đăng
 * ký. Dùng chung cho cả 2 lối vào:
 *   - "Người bán" (bên trái header) — registerRole="seller"
 *   - "Đăng nhập" của người mua (bên phải header) — registerRole="buyer"
 * Sau khi đăng nhập thành công, nếu tài khoản có role "seller" sẽ tự điều
 * hướng sang /seller; ngược lại chỉ đóng dropdown lại (ở nguyên trang).
 */
export default function AuthDropdown({
  triggerLabel,
  registerRole,
  className = "relative",
  triggerClassName = "hover:text-gray-900",
}) {
  const router = useRouter();
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);

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
    setOpen((v) => !v);
  }

  function handleLoginSuccess(role) {
    setOpen(false);
    if (role === "seller") {
      router.push("/seller");
    }
  }

  return (
    <div className={className} ref={containerRef}>
      <button type="button" onClick={toggleOpen} className={triggerClassName}>
        {triggerLabel}
      </button>

      {open && (
        <div className="absolute top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-5 z-50 text-left">
          <p className="text-sm font-semibold text-gray-900 mb-3">
            {registerRole === "seller" ? "Người bán đăng nhập" : "Người mua đăng nhập"}
          </p>

          <QuickLoginForm onSuccess={handleLoginSuccess} role={registerRole} />

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
