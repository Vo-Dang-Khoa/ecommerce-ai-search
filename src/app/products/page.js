import Link from "next/link";
import ProductCard from "../components/ProductCard";
import { CATEGORIES, PRODUCTS } from "@/lib/products";

export const metadata = {
  title: "Sản phẩm - ShopAI",
  description: "Danh sách bánh của ShopAI",
};

export default async function ProductsPage({ searchParams }) {
  const { category } = await searchParams;
  const products = category
    ? PRODUCTS.filter((p) => p.category === category)
    : PRODUCTS;

  return (
    <main className="flex-1 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sản phẩm</h1>
        <p className="text-gray-600 mb-8">
          {category
            ? `Danh mục: ${category}`
            : "Tất cả các loại bánh của ShopAI"}
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
      </div>
    </main>
  );
}
