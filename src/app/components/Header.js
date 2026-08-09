"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth, useCart } from "../providers";

const SEARCH_MODES = [
  { href: "/search/image", icon: "📷", label: "Tìm kiếm bằng hình ảnh" },
  { href: "/search/video", icon: "🎥", label: "Tìm kiếm bằng Video" },
  { href: "/search/voice", icon: "🎤", label: "Tìm kiếm bằng giọng nói" },
  { href: "/search/barcode", icon: "🔲", label: "Tìm kiếm bằng mã vạch, QR" },
];

export default function Header() {
  const router = useRouter();
  const { totalCount } = useCart();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");
  // Menu di động (điện thoại/máy tính bảng, < lg): gồm các link điều hướng
  // và 4 lối vào tìm kiếm AI vốn chỉ hiện inline cạnh ô tìm kiếm ở màn
  // hình lớn (hidden lg:flex) — nếu không có menu này, người dùng trên
  // điện thoại/tablet sẽ không thể bấm vào "Sản phẩm", "Người bán", hay
  // các kiểu tìm kiếm bằng hình ảnh/video/giọng nói/mã vạch.
  const [menuOpen, setMenuOpen] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    setMenuOpen(false);
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  // Người bán: đã đăng nhập với vai trò seller -> vào thẳng kênh người
  // bán. Chưa đăng nhập (hoặc đang là buyer) -> điều hướng sang trang
  // /login?role=seller, hiện bảng "Người bán đăng nhập" ngay trong thân
  // trang (KHÔNG dùng dropdown nổi).
  const sellerHref = user?.role === "seller" ? "/seller" : "/login?role=seller";

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={menuOpen}
          className="lg:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:border-gray-900"
        >
          {menuOpen ? "✕" : "☰"}
        </button>

        <div className="flex items-center gap-6 shrink-0">
          <Link
            href="/"
            onClick={closeMenu}
            className="text-lg sm:text-xl font-bold text-gray-900"
          >
            ShopAI
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-gray-600">
            <Link href="/products" className="hover:text-gray-900">
              Sản phẩm
            </Link>
            <Link href="/loi-cam-on" className="hover:text-gray-900">
              Lời cảm ơn
            </Link>
            <Link href={sellerHref} className="hover:text-gray-900">
              Người bán
            </Link>
          </nav>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 flex items-center justify-center gap-1.5 min-w-0"
        >
          <div className="flex items-center w-full max-w-xl border border-gray-300 rounded-full pl-3 sm:pl-4 pr-1.5 py-1.5 gap-2 focus-within:border-gray-900 transition-colors">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm sản phẩm..."
              className="flex-1 text-sm outline-none bg-transparent min-w-0"
            />
            <button
              type="submit"
              aria-label="Tìm kiếm"
              className="text-gray-500 hover:text-gray-900 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 shrink-0"
            >
              🔍
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-1 shrink-0">
            {SEARCH_MODES.map((mode) => (
              <Link
                key={mode.href}
                href={mode.href}
                title={mode.label}
                aria-label={mode.label}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-lg"
              >
                {mode.icon}
              </Link>
            ))}
          </div>
        </form>

        <div className="flex items-center gap-3 sm:gap-4 text-sm text-gray-600 shrink-0">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Bấm vào email/vai trò -> trang /account để chỉnh sửa
                  email, số điện thoại, địa chỉ liên lạc. */}
              <Link
                href="/account"
                className="hidden sm:inline-flex items-center gap-1.5 text-gray-700 hover:text-gray-900"
              >
                {user.email}{" "}
                <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                  {user.role === "seller" ? "Người bán" : "Người mua"}
                </span>
              </Link>
              <button
                onClick={logout}
                className="text-sm bg-gray-900 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-gray-800"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            /* Đăng nhập: dành cho người mua. Chưa đăng nhập -> điều hướng
               sang trang /login?role=buyer, hiện bảng "Người mua đăng
               nhập" ngay trong thân trang (KHÔNG dùng dropdown nổi). */
            <Link href="/login?role=buyer" className="hover:text-gray-900">
              Đăng nhập
            </Link>
          )}

          <Link href="/cart" className="relative hover:text-gray-900">
            Giỏ hàng
            {totalCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-gray-900 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {totalCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Menu di động: thay thế cho nav + các icon tìm kiếm bị ẩn (hidden
          lg:flex) trên điện thoại và máy tính bảng đứng. */}
      {menuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white px-4 py-4">
          <nav className="flex flex-col gap-1 text-sm mb-4">
            <Link
              href="/products"
              onClick={closeMenu}
              className="px-2 py-2.5 rounded-md hover:bg-gray-50 text-gray-700"
            >
              Sản phẩm
            </Link>
            <Link
              href="/loi-cam-on"
              onClick={closeMenu}
              className="px-2 py-2.5 rounded-md hover:bg-gray-50 text-gray-700"
            >
              Lời cảm ơn
            </Link>
            <Link
              href={sellerHref}
              onClick={closeMenu}
              className="px-2 py-2.5 rounded-md hover:bg-gray-50 text-gray-700"
            >
              Người bán
            </Link>
            {user && (
              <Link
                href="/account"
                onClick={closeMenu}
                className="px-2 py-2.5 rounded-md hover:bg-gray-50 text-gray-700"
              >
                Tài khoản của tôi ({user.email})
              </Link>
            )}
          </nav>

          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-2 mb-1">
            Tìm kiếm bằng AI
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {SEARCH_MODES.map((mode) => (
              <Link
                key={mode.href}
                href={mode.href}
                onClick={closeMenu}
                className="flex items-center gap-2.5 px-2 py-2.5 rounded-md hover:bg-gray-50 text-gray-700 text-sm"
              >
                <span className="text-lg">{mode.icon}</span>
                {mode.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
