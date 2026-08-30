"use client";

import Link from "next/link";
import ProductCard from "../components/ProductCard";
import RecommendedForYou from "../components/RecommendedForYou";
import { CATEGORIES } from "@/lib/products";
import { useShop } from "../providers";

export default function ProductsBrowser({ category }) {
  const { allProducts } = useShop();
  const products = category
    ? allProducts.filter((p) => p.category === category)
    : allProducts;

  return (
    <>
      {/* Gợi ý cá nhân hoá — chỉ hiện ở chế độ xem "Tất cả" (chưa lọc theo
          1 danh mục cụ thể), tránh trùng lặp/rối mắt khi danh sách bên dưới
          đã lọc sẵn theo đúng 1 danh mục. */}
      {!category && (
        <div className="mb-12">
          <RecommendedForYou limit={4} />
        </div>
      )}

      <p className="text-gray-600 mb-8">
        {category ? `Danh mục: ${category}` : "Tất cả các loại bánh của ShopAI"}
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/products"
          className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
            !category
              ? "bg-gray-900 text-white border-gray-900"
              : "border-gray-300 text-gray-700 hover:border-gray-900"
          }`}
        >
          Tất cả
        </Link>
        {CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`/products?category=${encodeURIComponent(cat)}`}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              category === cat
                ? "bg-gray-900 text-white border-gray-900"
                : "border-gray-300 text-gray-700 hover:border-gray-900"
            }`}
          >
            {cat}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="text-gray-500">Không tìm thấy sản phẩm nào.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}
