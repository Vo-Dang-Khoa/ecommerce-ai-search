"use client";

import Link from "next/link";
import { getBannerTheme } from "@/lib/banners";

/**
 * Thẻ banner quảng cáo — ảnh nền theo tỉ lệ ngang (xem BANNER_ASPECT ở
 * src/lib/banners.js) phủ gradient theo tông màu (theme) người bán đã chọn
 * để chữ trắng luôn đọc được dù ảnh nền sáng/tối, kèm tiêu đề/mô tả ngắn và
 * nhãn tên gian hàng — giống banner "được tài trợ" trên các sàn TMĐT thật.
 * Chỉ là component HIỂN THỊ THUẦN TUÝ — việc chọn banner nào để hiện nằm ở
 * AdSlot.js. Ảnh dùng `loading="lazy"` (khác PromotionBanner.js khi được
 * đánh dấu `priority`) vì banner này KHÔNG BAO GIỜ là banner đầu tiên/quan
 * trọng nhất của trang (luôn nằm dưới HeroSection hoặc dưới thanh điều
 * hướng ngành hàng) — trì hoãn tải ảnh này giúp trang ưu tiên tải xong phần
 * đầu trang trước, tránh giật lag do quá nhiều ảnh cùng tải 1 lúc.
 *
 * @param {{banner: object, className?: string}} props
 */
export default function AdBanner({ banner, className = "" }) {
  const theme = getBannerTheme(banner.theme);

  const content = (
    <div
      className={`relative w-full overflow-hidden rounded-2xl group ${className}`}
      style={{ aspectRatio: "3 / 1" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh banner từ Supabase Storage, URL tuỳ ý */}
      <img
        src={banner.imageUrl}
        alt={banner.title}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className={`absolute inset-0 bg-gradient-to-r ${theme.overlay}`} />
      <div className="absolute inset-0 flex flex-col justify-center gap-1 px-6 sm:px-10">
        {banner.shopName && (
          <span className="text-[11px] uppercase tracking-wide text-white/70 font-medium">
            Gian hàng {banner.shopName}
          </span>
        )}
        <h3 className="text-lg sm:text-2xl font-bold text-white max-w-md">{banner.title}</h3>
        {banner.subtitle && (
          <p className="text-sm text-white/85 max-w-md hidden sm:block">{banner.subtitle}</p>
        )}
      </div>
    </div>
  );

  if (!banner.linkUrl) return content;

  // Đường dẫn nội bộ (VD: /products?category=...) dùng next/link để chuyển
  // trang không tải lại toàn bộ app; đường dẫn ngoài (nếu người bán dán link
  // Facebook/Zalo gian hàng...) mở ở tab mới.
  const isInternal = banner.linkUrl.startsWith("/");
  if (isInternal) {
    return (
      <Link href={banner.linkUrl} className="block">
        {content}
      </Link>
    );
  }
  return (
    <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="block">
      {content}
    </a>
  );
}
