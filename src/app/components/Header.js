export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <a href="/" className="text-xl font-bold text-gray-900">
          ShopAI
        </a>

        <nav className="hidden md:flex gap-6 text-sm text-gray-600">
          <a href="/products" className="hover:text-gray-900">
            Sản phẩm
          </a>
          <a href="/search" className="hover:text-gray-900">
            Tìm kiếm AI
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <a href="/cart" className="text-sm text-gray-700 hover:text-gray-900">
            Giỏ hàng
          </a>
          <a
            href="/login"
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800"
          >
            Đăng nhập
          </a>
        </div>
      </div>
    </header>
  );
}
