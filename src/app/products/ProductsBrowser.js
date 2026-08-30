"use client";

import { useMemo } from "react";
import Link from "next/link";
import ProductCard from "../components/ProductCard";
import RecommendedForYou from "../components/RecommendedForYou";
import AdSlot from "../components/AdSlot";
import IndustrySection from "../components/IndustrySection";
import { CATEGORIES } from "@/lib/products";
import { getDescendantCategoryIds } from "@/lib/categories";
import { isPromotionLive } from "@/lib/promotions";
import { useShop } from "../providers";

export default function ProductsBrowser({ category }) {
  const { allProducts, categories, categoryPromotions, hydrated } = useShop();

  // Chế độ CŨ: đã chọn 1 trong 8 danh mục bánh cũ (chip bên dưới, hoặc link
  // "Danh mục bánh" ở trang chủ) -> lọc phẳng theo cột category (text) như
  // trước đây, KHÔNG dùng bố cục theo ngành hàng mới.
  const legacyFilteredProducts = category
    ? allProducts.filter((p) => p.category === category)
    : [];

  // Chế độ MẶC ĐỊNH ("Tất cả"): mỗi ngành hàng (1 trong 12 danh mục cha, xem
  // supabase/schema.sql mục 9) hiện thành 1 khối riêng — IndustrySection.js
  // lo phần băng chuyền 4 ô + Xem thêm/Thu gọn, ở đây chỉ cần gom trước sản
  // phẩm + khuyến mãi ĐÚNG của từng ngành hàng.
  const industries = useMemo(() => {
    if (category || !hydrated) return [];

    const roots = categories
      .filter((c) => !c.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi"));

    return roots.map((root) => {
      const descendantIds = getDescendantCategoryIds(root.id, categories);
      const products = allProducts.filter(
        (p) => p.categoryId && descendantIds.includes(p.categoryId)
      );
      const promotion =
        categoryPromotions.find((p) => p.categoryId === root.id && isPromotionLive(p)) || null;
      return { id: root.id, title: root.name, products, promotion };
    });
  }, [category, hydrated, categories, allProducts, categoryPromotions]);

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
        {category ? `Danh mục: ${category}` : "Khám phá sản phẩm theo từng ngành hàng của ShopAI"}
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

      {/* Banner quảng cáo của GIAN HÀNG (khác banner khuyến mãi theo ngành
          hàng ở IndustrySection bên dưới) — hiện ở mọi chế độ xem, khác với
          mục "Gợi ý dành cho bạn" ở trên chỉ hiện khi xem "Tất cả". AdSlot
          tự ẩn (return null) nếu chưa có banner nào. */}
      <div className="mb-8">
        <AdSlot />
      </div>

      {category ? (
        legacyFilteredProducts.length === 0 ? (
          <p className="text-gray-500">Không tìm thấy sản phẩm nào.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {legacyFilteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )
      ) : (
        industries.map((industry) => (
          <IndustrySection
            key={industry.id}
            title={industry.title}
            products={industry.products}
            promotion={industry.promotion}
          />
        ))
      )}
    </>
  );
}
