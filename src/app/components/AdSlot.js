"use client";

import { useShop } from "../providers";
import { pickBanner } from "@/lib/banners";
import AdBanner from "./AdBanner";

/**
 * Một VỊ TRÍ hiển thị banner quảng cáo trên trang (trang chủ, danh sách/
 * danh mục sản phẩm, chi tiết sản phẩm — xem src/lib/banners.js) — tự lấy
 * danh sách banner từ ShopContext rồi chọn ra 1 banner bằng pickBanner().
 * Không hiển thị gì (return null) nếu chưa có banner nào đang bật, để
 * không để lại khoảng trống thừa trên trang khi chưa có người bán nào tạo
 * banner.
 *
 * @param {{
 *   preferShopId?: string|null,
 *   excludeShopId?: string|null,
 *   className?: string,
 * }} props
 */
export default function AdSlot({ preferShopId = null, excludeShopId = null, className = "" }) {
  const { banners, hydrated } = useShop();
  if (!hydrated) return null;

  const banner = pickBanner(banners, { preferShopId, excludeShopId });
  if (!banner) return null;

  return <AdBanner banner={banner} className={className} />;
}
