"use client";

import Link from "next/link";
import { useAuth, useCart } from "../providers";

export default function Header() {
  const { totalCount } = useCart();
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
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

        <div className="flex items-center gap-4">
          <Link
            href="/cart"
            className="relative text-sm text-gray-700 hover:text-gray-900"
          >
            Giỏ hàng
            {totalCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-gray-900 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {totalCount}
              </span>
            )}
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 hidden sm:inline">
                {user.email}
              </span>
              <button
                onClick={logout}
                className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800"
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
