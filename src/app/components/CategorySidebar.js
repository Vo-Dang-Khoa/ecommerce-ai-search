"use client";

import Link from "next/link";
import { containsActiveSlug } from "@/lib/categories";

// 1 node trong cây danh mục — dùng thẻ <details>/<summary> để có sẵn hành
// vi mở/đóng (expand/collapse) mà không cần tự quản lý state cho từng
// node, tự động mở nếu danh mục đang xem nằm bên trong nhánh này.
function CategoryNode({ node, activeSlug }) {
  const isActive = node.slug === activeSlug;

  if (node.children.length === 0) {
    return (
      <li>
        <Link
          href={`/danh-muc/${node.slug}`}
          className={`block px-2 py-1.5 rounded-md text-sm transition-colors ${
            isActive
              ? "bg-gray-900 text-white"
              : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          {node.name}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <details open={containsActiveSlug(node, activeSlug)} className="group">
        <summary
          className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm cursor-pointer list-none transition-colors ${
            isActive
              ? "bg-gray-900 text-white"
              : "text-gray-900 font-medium hover:bg-gray-50"
          }`}
        >
          <Link
            href={`/danh-muc/${node.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1"
          >
            {node.name}
          </Link>
          <span className="text-xs text-gray-400 group-open:rotate-180 transition-transform">
            ▾
          </span>
        </summary>
        <ul className="pl-3 mt-1 flex flex-col gap-0.5 border-l border-gray-100">
          {node.children.map((child) => (
            <CategoryNode key={child.id} node={child} activeSlug={activeSlug} />
          ))}
        </ul>
      </details>
    </li>
  );
}

// Sidebar cây danh mục đa cấp (Category -> Product Type) — render động từ
// dữ liệu bảng `categories` (Supabase), dùng ở trang /danh-muc/[slug].
export default function CategorySidebar({ categoryTree, activeSlug }) {
  return (
    <nav className="border border-gray-200 rounded-xl p-3">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-2 mb-2">
        Danh mục sản phẩm
      </p>
      <Link
        href="/danh-muc"
        className={`block px-2 py-1.5 rounded-md text-sm mb-1 transition-colors ${
          !activeSlug
            ? "bg-gray-900 text-white"
            : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
        }`}
      >
        Tất cả danh mục
      </Link>
      {categoryTree.length === 0 ? (
        <p className="text-xs text-gray-400 px-2 py-1.5">
          Chưa có danh mục nào — hãy chạy supabase/schema.sql (bản mới nhất).
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {categoryTree.map((node) => (
            <CategoryNode key={node.id} node={node} activeSlug={activeSlug} />
          ))}
        </ul>
      )}
    </nav>
  );
}
