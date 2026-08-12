"use client";

import { useMemo, useState } from "react";
import ProductCard from "../../components/ProductCard";
import CategorySidebar from "../../components/CategorySidebar";
import { useShop } from "../../providers";
import {
  buildCategoryTree,
  findCategoryBySlug,
  getDescendantCategoryIds,
  getCategoryPath,
} from "@/lib/categories";

// Trang danh mục mới (/danh-muc/[slug]): liệt kê sản phẩm theo CÂY DANH MỤC
// ĐA CẤP (category_id) thay vì cột category (text tự do) cũ, kèm bộ lọc
// động dựa trên category_attributes — hoàn toàn KHÔNG cần đổi cấu trúc
// bảng products mỗi khi có thuộc tính lọc mới.
export default function CategoryBrowser({ slug }) {
  const { allProducts, categories, categoryAttributes, hydrated, loadError } = useShop();
  // { [attributeKey]: giá trị đang chọn để lọc }
  const [filters, setFilters] = useState({});

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const category = useMemo(() => findCategoryBySlug(categories, slug), [categories, slug]);
  const breadcrumb = useMemo(
    () => (category ? getCategoryPath(category.id, categories) : []),
    [category, categories]
  );

  const descendantIds = useMemo(
    () => (category ? getDescendantCategoryIds(category.id, categories) : []),
    [category, categories]
  );

  // Sản phẩm thuộc danh mục này HOẶC bất kỳ danh mục con/cháu nào bên dưới
  // (vd xem danh mục cha vẫn thấy sản phẩm gắn ở danh mục con).
  const categoryProducts = useMemo(
    () => allProducts.filter((p) => p.categoryId && descendantIds.includes(p.categoryId)),
    [allProducts, descendantIds]
  );

  // Thuộc tính CÓ THỂ LỌC khai báo riêng cho danh mục này (không kế thừa từ
  // danh mục cha, vì mỗi loại sản phẩm thường có bộ thuộc tính khác nhau).
  const availableAttributes = useMemo(
    () => (category ? categoryAttributes.filter((a) => a.categoryId === category.id) : []),
    [category, categoryAttributes]
  );

  const hasActiveFilters = Object.values(filters).some((v) => v);

  const filteredProducts = useMemo(() => {
    if (!hasActiveFilters) return categoryProducts;
    return categoryProducts.filter((product) =>
      Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        const attr = (product.attributes || []).find((a) => a.key === key);
        return attr?.value === value;
      })
    );
  }, [categoryProducts, filters, hasActiveFilters]);

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters({});
  }

  if (!hydrated) return null;

  if (loadError) {
    return <p className="text-red-600 text-sm">{loadError}</p>;
  }

  if (!category) {
    return (
      <p className="text-gray-500">
        Không tìm thấy danh mục này — có thể chưa chạy supabase/schema.sql
        (bản v8 mới nhất) để khởi tạo bảng categories.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <aside className="lg:col-span-1">
        <CategorySidebar categoryTree={categoryTree} activeSlug={slug} />
      </aside>

      <div className="lg:col-span-3">
        <p className="text-xs text-gray-400 mb-2">
          {breadcrumb.map((c) => c.name).join(" / ")}
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{category.name}</h1>
        <p className="text-gray-600 mb-6">{filteredProducts.length} sản phẩm</p>

        {availableAttributes.length > 0 && (
          <div className="flex flex-wrap items-end gap-3 mb-8 border border-gray-200 rounded-xl p-4">
            {availableAttributes.map((attr) => (
              <div key={attr.id} className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">{attr.label}</label>
                {attr.inputType === "select" && attr.options?.length > 0 ? (
                  <select
                    value={filters[attr.key] || ""}
                    onChange={(e) => handleFilterChange(attr.key, e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:border-gray-900"
                  >
                    <option value="">Tất cả</option>
                    {attr.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={filters[attr.key] || ""}
                    onChange={(e) => handleFilterChange(attr.key, e.target.value)}
                    placeholder={`Lọc theo ${attr.label.toLowerCase()}...`}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:border-gray-900"
                  />
                )}
              </div>
            ))}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-900 underline mb-1.5"
              >
                Xoá bộ lọc
              </button>
            )}
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <p className="text-gray-500">
            {hasActiveFilters
              ? "Không có sản phẩm nào khớp bộ lọc đã chọn."
              : "Chưa có sản phẩm nào trong danh mục này."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
