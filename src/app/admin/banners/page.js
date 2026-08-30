"use client";

import Link from "next/link";
import { useAuth, useShop } from "../../providers";
import BannerReviewCard from "../BannerReviewCard";

// v15 — Hàng chờ duyệt banner quảng cáo của gian hàng (/admin/banners), xem
// supabase/schema.sql mục 5D + mục 11. CHỈ Admin (profiles.role = 'admin')
// xem/duyệt được — RLS "Admin can read all shop banners" cho phép Admin
// thấy TOÀN BỘ banner (mọi trạng thái), khác với người bán chỉ thấy banner
// của chính mình. Ưu tiên hiển thị "Đang chờ duyệt" (pending) lên đầu vì
// đây là việc cần Admin xử lý ngay; các trạng thái khác xếp bên dưới để
// tham khảo/duyệt lại nếu cần.
export default function AdminBannersPage() {
  const { user, hydrated: authHydrated, logout } = useAuth();
  const { banners, hydrated: shopHydrated } = useShop();

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

  const pending = banners.filter((b) => b.reviewStatus === "pending");
  const others = banners
    .filter((b) => b.reviewStatus !== "pending")
    .sort((a, b) => a.shopName.localeCompare(b.shopName, "vi"));

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">Duyệt banner quảng cáo gian hàng</h1>
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

        <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 underline">
          ← Quản lý khuyến mãi theo ngành hàng
        </Link>

        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            Đang chờ duyệt {pending.length > 0 && `(${pending.length})`}
          </h2>
          {pending.length === 0 ? (
            <p className="text-gray-400 text-sm py-6 text-center border border-dashed border-gray-300 rounded-xl">
              Không có banner nào đang chờ duyệt.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {pending.map((banner) => (
                <BannerReviewCard key={banner.id} banner={banner} />
              ))}
            </div>
          )}
        </div>

        {others.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Banner khác</h2>
            <div className="flex flex-col gap-4">
              {others.map((banner) => (
                <BannerReviewCard key={banner.id} banner={banner} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
