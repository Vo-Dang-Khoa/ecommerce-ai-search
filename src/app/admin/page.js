"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth, useShop } from "../providers";
import PromotionEditor from "./PromotionEditor";

// Trang quản lý khuyến mãi THEO NGÀNH HÀNG (v14) — CHỈ Admin (profiles.role
// = 'admin') xem/sửa được, xem hướng dẫn tự nâng quyền Admin ở
// supabase/schema.sql mục 10. Liệt kê đủ 12 ngành hàng, mỗi ngành hàng có
// tối đa 1 khuyến mãi (PromotionEditor.js lo phần tạo/sửa/xoá từng dòng).
export default function AdminPage() {
  const { user, hydrated: authHydrated, logout } = useAuth();
  const { categories, categoryPromotions, hydrated: shopHydrated } = useShop();
  const [openCategoryId, setOpenCategoryId] = useState(null);

  if (!authHydrated || !shopHydrated) return null;

  if (!user || user.role !== "admin") {
    return (
      <main className="flex-1 bg-gray-50">
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <p className="text-gray-600 mb-6">
            Bạn cần đăng nhập bằng tài khoản Admin để xem trang này.
          </p>
          <Link
            href="/admin/login"
            className="bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
          >
            Đăng nhập Admin
          </Link>
        </div>
      </main>
    );
  }

  const roots = categories
    .filter((c) => !c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi"));

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">
              Quản lý khuyến mãi theo ngành hàng
            </h1>
            <p className="text-sm text-gray-500 mt-1 truncate">Đăng nhập: {user.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md px-3 py-1.5 shrink-0"
          >
            Đăng xuất
          </button>
        </div>

        {roots.length === 0 ? (
          <p className="text-gray-500">
            Chưa tải được danh mục ngành hàng — kiểm tra đã chạy supabase/schema.sql chưa.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {roots.map((category) => (
              <PromotionEditor
                key={category.id}
                category={category}
                promotion={categoryPromotions.find((p) => p.categoryId === category.id) || null}
                isOpen={openCategoryId === category.id}
                onOpen={() => setOpenCategoryId(category.id)}
                onClose={() => setOpenCategoryId(null)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
