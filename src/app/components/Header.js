"use client";

import Link from "next/link";
import { useAuth, useCart } from "../providers";

export default function Header() {
  const { totalCount } = useCart();
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="border-b border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center gap-4 text-xs text-gray-600">
          <Link href="/seller" className="hover:text-gray-900">
            Người bán đăng nhập
          </Link>

          {user ? (
            <span className="flex items-center gap-2">
              <span className="text-gray-700">{user.email}</span>
              <button onClick={logout} className="hover:text-gray-900 underline">
                Đăng xuất
              </button>
            </span>
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

      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gray-900">
          ShopAI
        </Link>

        <nav className="hidden md:flex gap-6 text-sm text-gray-600">
          <Link href="/products" className="hover:text-gray-900">
            Sản phẩm
          </Link>
          <Link href="/search" className="hover:text-gray-900">
            Tìm kiếm AI
          </Link>
          <Link href="/loi-cam-on" className="hover:text-gray-900">
            Lời cảm ơn
          </Link>
        </nav>
      </div>
    </header>
  );
}
