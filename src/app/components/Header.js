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

  function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-6 shrink-0">
          <Link href="/" className="text-xl font-bold text-gray-900">
            ShopAI
          </Link>
          <nav className="hidden md:flex gap-6 text-sm text-gray-600">
            <Link href="/products" className="hover:text-gray-900">
              Sản phẩm
            </Link>
            <Link href="/loi-cam-on" className="hover:text-gray-900">
              Lời cảm ơn
            </Link>
          </nav>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 flex items-center justify-center gap-1.5"
        >
          <div className="flex items-center w-full max-w-xl border border-gray-300 rounded-full pl-4 pr-1.5 py-1.5 gap-2 focus-within:border-gray-900 transition-colors">
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

        <div className="flex items-center gap-4 text-sm text-gray-600 shrink-0">
          <Link href="/seller" className="hidden sm:inline hover:text-gray-900">
            Người bán đăng nhập
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-gray-700">{user.email}</span>
              <button
                onClick={logout}
                className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <Link href="/login" className="hover:text-gray-900">
              Người mua đăng nhập
            </Link>
          )}

          <Link href="/cart" className="relative hover:text-gray-900">
            Giỏ hàng người mua
            {totalCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-gray-900 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {totalCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
