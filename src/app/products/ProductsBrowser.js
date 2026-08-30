"use client";

import { useMemo } from "react";
import Link from "next/link";
import ProductCard from "../components/ProductCard";
import AdSlot from "../components/AdSlot";
import IndustrySection from "../components/IndustrySection";
import { CATEGORIES } from "@/lib/products";
import { getDescendantCategoryIds } from "@/lib/categories";
import { useShop } from "../providers";

// Bảng màu (nền nhạt + chữ/viền cùng tông) tô cho 12 nút ngành hàng — mỗi
// ngành hàng 1 màu riêng theo THỨ TỰ hiển thị (sort_order, xem
// supabase/schema.sql mục 9) để dễ phân biệt bằng mắt, không dùng tên màu
// ghép chuỗi động (`bg-${color}-50`) vì Tailwind KHÔNG nhận diện được class
// tạo ra lúc chạy — phải khai báo sẵn từng class literal như dưới đây.
const INDUSTRY_NAV_COLORS = [
  { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", hover: "hover:bg-amber-100" },
  { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200", hover: "hover:bg-rose-100" },
  { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", hover: "hover:bg-emerald-100" },
  { bg: "bg-sky-50", text: "text-sky-800", border: "border-sky-200", hover: "hover:bg-sky-100" },
  { bg: "bg-violet-50", text: "text-violet-800", border: "border-violet-200", hover: "hover:bg-violet-100" },
  { bg: "bg-orange-50", text: "text-orange-800", border: "border-orange-200", hover: "hover:bg-orange-100" },
  { bg: "bg-teal-50", text: "text-teal-800", border: "border-teal-200", hover: "hover:bg-teal-100" },
  { bg: "bg-fuchsia-50", text: "text-fuchsia-800", border: "border-fuchsia-200", hover: "hover:bg-fuchsia-100" },
  { bg: "bg-lime-50", text: "text-lime-800", border: "border-lime-200", hover: "hover:bg-lime-100" },
  { bg: "bg-cyan-50", text: "text-cyan-800", border: "border-cyan-200", hover: "hover:bg-cyan-100" },
  { bg: "bg-indigo-50", text: "text-indigo-800", border: "border-indigo-200", hover: "hover:bg-indigo-100" },
  { bg: "bg-pink-50", text: "text-pink-800", border: "border-pink-200", hover: "hover:bg-pink-100" },
];

export default function ProductsBrowser({ category }) {
  const { allProducts, categories, hydrated } = useShop();

  // Chế độ CŨ: đã chọn 1 trong 8 danh mục bánh cũ (chip bên dưới, hoặc link
  // "Danh mục bánh" ở trang chủ) -> lọc phẳng theo cột category (text) như
  // trước đây, KHÔNG dùng bố cục theo ngành hàng mới.
  const legacyFilteredProducts = category
    ? allProducts.filter((p) => p.category === category)
    : [];

  // 12 ngành hàng (danh mục cha, xem supabase/schema.sql mục 9) — dùng CHO
  // CẢ 2 việc: (1) render thanh nút bấm nhanh "Tất cả" + 12 ngành hàng ngay
  // dưới đoạn giới thiệu (dùng được ở mọi chế độ xem, không cần đợi gom sản
  // phẩm), và (2) làm khung để gom sản phẩm ở industries bên dưới khi đang
  // xem "Tất cả".
  const roots = useMemo(() => {
    if (!hydrated) return [];
    return categories
      .filter((c) => !c.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi"));
  }, [hydrated, categories]);

  // Chế độ MẶC ĐỊNH ("Tất cả"): mỗi ngành hàng hiện thành 1 khối riêng —
  // IndustrySection.js lo phần băng chuyền 4 ô + Xem thêm/Thu gọn, ở đây
  // chỉ cần gom trước đúng sản phẩm của từng ngành hàng.
  const industries = useMemo(() => {
    if (category || roots.length === 0) return [];

    return roots.map((root) => {
      const descendantIds = getDescendantCategoryIds(root.id, categories);
      const products = allProducts.filter(
        (p) => p.categoryId && descendantIds.includes(p.categoryId)
      );
      return { id: root.id, title: root.name, products };
    });
  }, [category, roots, categories, allProducts]);

  return (
    <>
      <h1 id="products-top" className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 scroll-mt-24">
        {category ? `Danh mục: ${category}` : "Khám phá sản phẩm theo từng ngành hàng của ShopAI"}
      </h1>

      {category ? (
        // Chế độ CŨ (đã chọn 1 trong 8 danh mục bánh) — giữ nguyên thanh
        // chip cũ để chuyển qua lại giữa các danh mục này/về lại "Tất cả".
        <div className="flex flex-wrap gap-2 mb-8">
          <Link
            href="/products"
            className="text-sm px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:border-gray-900 transition-colors"
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
      ) : (
        // Thanh nút bấm nhanh 12 ngành hàng — bấm vào 1 ngành hàng thì
        // trang tự cuộn mượt xuống đúng khối ngành hàng đó (neo
        // #industry-<id> đặt trên section tương ứng ở IndustrySection.js),
        // KHÔNG tải lại trang hay lọc lại danh sách (đã bỏ nút "Tất cả" —
        // trang mặc định vốn đã hiện đủ cả 12 ngành hàng, và đã có nút nổi
        // "Về đầu trang" ở BackToTopButton.js lo việc quay lại đầu trang).
        // Lưới 6 cột (từ màn hình sm trở lên) để ĐÚNG 12 nút xếp vừa khít
        // 2 hàng (6 + 6); mỗi nút cao bằng nhau (items-stretch) và được
        // PHÉP xuống dòng (không ép 1 dòng) vì tên ngành hàng khá dài.
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-8 items-stretch">
          {roots.map((root, i) => {
            const color = INDUSTRY_NAV_COLORS[i % INDUSTRY_NAV_COLORS.length];
            return (
              <a
                key={root.id}
                href={`#industry-${root.id}`}
                className={`flex items-center justify-center text-center rounded-lg border ${color.bg} ${color.text} ${color.border} ${color.hover} transition-colors px-2 py-2.5 text-[11px] sm:text-xs font-semibold leading-tight`}
              >
                {root.name}
              </a>
            );
          })}
        </div>
      )}

      {/* Banner quảng cáo của GIAN HÀNG (do người bán tự tạo + đã được Admin
          duyệt — khác chương trình khuyến mãi theo ngành hàng do Admin trực
          tiếp tạo, chỉ còn hiện ở banner đầu trang chủ). AdSlot tự ẩn
          (return null) nếu chưa có banner nào. */}
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
            id={`industry-${industry.id}`}
            title={industry.title}
            products={industry.products}
          />
        ))
      )}
    </>
  );
}
