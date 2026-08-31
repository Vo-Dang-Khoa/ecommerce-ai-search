"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth, useCart } from "../providers";
import NavLink from "./NavLink";

const SEARCH_MODES = [
  { href: "/search/image", icon: "📷", label: "Tìm kiếm bằng hình ảnh" },
  { href: "/search/video", icon: "🎥", label: "Tìm kiếm bằng Video" },
  { href: "/search/voice", icon: "🎤", label: "Tìm kiếm bằng giọng nói" },
  { href: "/search/barcode", icon: "🔲", label: "Tìm kiếm bằng mã số, mã vạch, QR" },
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
          <NavLink
            href="/"
            onNavigate={closeMenu}
            className="text-lg sm:text-xl font-bold text-gray-900 whitespace-nowrap"
          >
            ShopAI
          </NavLink>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-gray-600">
            <NavLink href="/products" className="hover:text-gray-900 whitespace-nowrap">
              Sản phẩm
            </NavLink>
            <NavLink href="/danh-muc" className="hover:text-gray-900 whitespace-nowrap">
              Danh mục
            </NavLink>
            <NavLink href="/loi-cam-on" className="hover:text-gray-900 whitespace-nowrap">
              Lời cảm ơn
            </NavLink>
            {/* Đang đăng nhập bên Người bán: gộp email + nhãn "Người bán"
                ngay tại đây (bên trái, trước khung tìm kiếm) thay vì hiện
                lặp lại ở bên phải header như bên Người mua. */}
            {user?.role === "seller" ? (
              <NavLink
                href="/seller"
                className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900 shrink-0 whitespace-nowrap"
              >
                <span className="truncate max-w-[160px]">{user.email}</span>
                <span className="shrink-0 whitespace-nowrap text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                  Người bán
                </span>
              </NavLink>
            ) : (
              <NavLink href={sellerHref} className="hover:text-gray-900 whitespace-nowrap">
                Người bán
              </NavLink>
            )}
          </nav>
        </div>

        {/* Ô tìm kiếm hiển thị inline chỉ ở màn hình lớn (>= lg). Ở màn
            hình nhỏ/vừa (điện thoại, máy tính bảng) ô tìm kiếm được tách
            xuống thành 1 hàng riêng full-width bên dưới (xem khối
            "lg:hidden" ngay sau div này) để không phải tranh chỗ với logo,
            nút "Đăng xuất", "Giỏ hàng"... trên cùng 1 hàng gây chồng lấp. */}
        <form
          onSubmit={handleSubmit}
          className="hidden lg:flex flex-1 items-center justify-center gap-1.5 min-w-0"
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

          <div className="flex items-center gap-1 shrink-0">
            {SEARCH_MODES.map((mode) => (
              <NavLink
                key={mode.href}
                href={mode.href}
                title={mode.label}
                aria-label={mode.label}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-lg"
              >
                {mode.icon}
              </NavLink>
            ))}
          </div>
        </form>

        {/* Ở màn hình < lg, ô tìm kiếm inline ở trên bị ẩn -> đẩy hẳn nhóm
            nút bên phải (Đăng nhập/Đăng xuất, Giỏ hàng) ra sát mép phải
            bằng 1 spacer co giãn, thay vì để nó dựa vào flex-1 của form. */}
        <div className="flex-1 lg:hidden" />

        <div className="flex items-center gap-3 sm:gap-4 text-sm text-gray-600 shrink-0">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Bên Người bán: email + nhãn "Người bán" đã hiện ở bên
                  trái (trước khung tìm kiếm, xem nav ở trên) — không lặp
                  lại ở đây nữa. Bên Người mua vẫn hiện như cũ. */}
              {user.role !== "seller" && (
                <NavLink
                  href="/account"
                  className="hidden sm:inline-flex items-center gap-1.5 text-gray-700 hover:text-gray-900 shrink-0 whitespace-nowrap"
                >
                  <span className="truncate max-w-[140px]">{user.email}</span>
                  <span className="shrink-0 whitespace-nowrap text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                    Người mua
                  </span>
                </NavLink>
              )}
              <button
                onClick={logout}
                className="shrink-0 whitespace-nowrap text-sm bg-gray-900 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-gray-800"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            /* Đăng nhập: dành cho người mua. Chưa đăng nhập -> điều hướng
               sang trang /login?role=buyer, hiện bảng "Người mua đăng
               nhập" ngay trong thân trang (KHÔNG dùng dropdown nổi). */
            <NavLink
              href="/login?role=buyer"
              className="shrink-0 whitespace-nowrap hover:text-gray-900"
            >
              Đăng nhập
            </NavLink>
          )}

          <NavLink href="/cart" className="relative shrink-0 whitespace-nowrap hover:text-gray-900">
            Giỏ hàng
            {totalCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-gray-900 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {totalCount}
              </span>
            )}
          </NavLink>
        </div>
      </div>

      {/* Hàng tìm kiếm riêng cho màn hình < lg (điện thoại, máy tính bảng):
          full-width, nằm ngay dưới hàng chính, luôn hiển thị (không phụ
          thuộc menuOpen) để không mất chức năng tìm kiếm khi ô tìm kiếm
          inline ở hàng trên bị ẩn. */}
      <div className="lg:hidden border-t border-gray-100 px-3 sm:px-4 py-2.5">
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <div className="flex items-center w-full border border-gray-300 rounded-full pl-3 sm:pl-4 pr-1.5 py-1.5 gap-2 focus-within:border-gray-900 transition-colors">
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
        </form>
      </div>

      {/* Menu di động: thay thế cho nav + các icon tìm kiếm bị ẩn (hidden
          lg:flex) trên điện thoại và máy tính bảng đứng. */}
      {menuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white px-4 py-4">
          <nav className="flex flex-col gap-1 text-sm mb-4">
            <NavLink
              href="/products"
              onNavigate={closeMenu}
              className="px-2 py-2.5 rounded-md hover:bg-gray-50 text-gray-700"
            >
              Sản phẩm
            </NavLink>
            <NavLink
              href="/danh-muc"
              onNavigate={closeMenu}
              className="px-2 py-2.5 rounded-md hover:bg-gray-50 text-gray-700"
            >
              Danh mục
            </NavLink>
            <NavLink
              href="/loi-cam-on"
              onNavigate={closeMenu}
              className="px-2 py-2.5 rounded-md hover:bg-gray-50 text-gray-700"
            >
              Lời cảm ơn
            </NavLink>
            {user?.role === "seller" ? (
              <NavLink
                href="/seller"
                onNavigate={closeMenu}
                className="flex items-center gap-1.5 px-2 py-2.5 rounded-md hover:bg-gray-50 text-gray-700"
              >
                <span className="truncate">{user.email}</span>
                <span className="shrink-0 whitespace-nowrap text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                  Người bán
                </span>
              </NavLink>
            ) : (
              <NavLink
                href={sellerHref}
                onNavigate={closeMenu}
                className="px-2 py-2.5 rounded-md hover:bg-gray-50 text-gray-700"
              >
                Người bán
              </NavLink>
            )}
          </nav>

          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-2 mb-1">
            Tìm kiếm bằng AI
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {SEARCH_MODES.map((mode) => (
              <NavLink
                key={mode.href}
                href={mode.href}
                onNavigate={closeMenu}
                className="flex items-center gap-2.5 px-2 py-2.5 rounded-md hover:bg-gray-50 text-gray-700 text-sm"
              >
                <span className="text-lg">{mode.icon}</span>
                {mode.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
