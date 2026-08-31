"use client";

import Link from "next/link";
import { getBannerTheme } from "@/lib/banners";
import { PROMOTION_STATUS_LABEL, getPromotionStatus } from "@/lib/promotions";

// Nhãn trạng thái nhỏ ở góc banner — màu khác nhau để phân biệt nhanh "Sắp
// diễn ra" (sắp tới, còn thời gian chuẩn bị) và "Đang diễn ra" (áp dụng
// ngay). "Đã kết thúc" thực ra KHÔNG BAO GIỜ hiện ra trong luân phiên công
// khai (đã bị lọc bởi isPromotionLive() ở nơi gọi) — chỉ có thể thấy ở trang
// quản lý /admin, nên vẫn khai báo màu cho đủ.
const STATUS_BADGE_CLASS = {
  upcoming: "bg-sky-500/90 text-white",
  ongoing: "bg-emerald-500/90 text-white",
  ended: "bg-gray-500/90 text-white",
};

/**
 * Thẻ banner khuyến mãi THEO NGÀNH HÀNG (v14, xem supabase/schema.sql mục
 * 10 và src/lib/promotions.js) — giống hệt cấu trúc AdBanner.js (banner
 * gian hàng) nhưng thêm NHÃN TRẠNG THÁI (Sắp diễn ra/Đang diễn ra) ở góc và
 * hiện TÊN NGÀNH HÀNG thay vì tên gian hàng. Chỉ là component HIỂN THỊ
 * THUẦN TUÝ — nơi gọi (PromotionHeroBanner.js, trang /products) tự lọc và
 * chọn khuyến mãi nào để truyền vào.
 *
 * `priority`: đánh dấu ảnh này là ảnh QUAN TRỌNG NHẤT của trang (Largest
 * Contentful Paint) — CHỈ bật ở banner khuyến mãi đầu trang chủ
 * (HeroSection.js truyền `priority` cho khuyến mãi đang hiện), giúp trình
 * duyệt tải ảnh này NGAY LẬP TỨC thay vì trì hoãn như ảnh bình thường, nhờ
 * đó phần đầu trang hiện ra nhanh nhất có thể. Mọi nơi khác (banner riêng
 * từng ngành hàng ở trang /products, xem trước ở /admin) đều để mặc định
 * `loading="lazy"` vì không phải nội dung xuất hiện đầu tiên khi tải trang.
 *
 * @param {{promotion: object, className?: string, priority?: boolean}} props
 */
export default function PromotionBanner({ promotion, className = "", priority = false }) {
  const theme = getBannerTheme(promotion.theme);
  const status = getPromotionStatus(promotion);

  const content = (
    <div
      className={`relative w-full overflow-hidden rounded-2xl group ${className}`}
      style={{ aspectRatio: "3 / 1" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh khuyến mãi từ Supabase Storage, URL tuỳ ý */}
      <img
        src={promotion.imageUrl}
        alt={promotion.title}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className={`absolute inset-0 bg-gradient-to-r ${theme.overlay}`} />

      {status && (
        <span
          className={`absolute top-3 left-3 sm:top-4 sm:left-4 text-[11px] font-semibold rounded-full px-2.5 py-1 ${STATUS_BADGE_CLASS[status]}`}
        >
          {PROMOTION_STATUS_LABEL[status]}
        </span>
      )}

      <div className="absolute inset-0 flex flex-col justify-center gap-1 px-6 sm:px-10">
        {promotion.categoryName && (
          <span className="text-[11px] uppercase tracking-wide text-white/70 font-medium">
            {promotion.categoryName}
          </span>
        )}
        <h3 className="text-lg sm:text-2xl font-bold text-white max-w-md">{promotion.title}</h3>
        {promotion.subtitle && (
          <p className="text-sm text-white/85 max-w-md hidden sm:block">{promotion.subtitle}</p>
        )}
      </div>
    </div>
  );

  if (!promotion.linkUrl) return content;

  const isInternal = promotion.linkUrl.startsWith("/");
  if (isInternal) {
    return (
      <Link href={promotion.linkUrl} className="block">
        {content}
      </Link>
    );
  }
  return (
    <a href={promotion.linkUrl} target="_blank" rel="noopener noreferrer" className="block">
      {content}
    </a>
  );
}
