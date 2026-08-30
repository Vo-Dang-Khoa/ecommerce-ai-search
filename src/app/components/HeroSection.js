"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useShop } from "../providers";
import { isPromotionLive, getPromotionStatus } from "@/lib/promotions";
import PromotionBanner from "./PromotionBanner";

const ROTATE_MS = 6000;
// Ưu tiên hiện "Đang diễn ra" trước "Sắp diễn ra" khi luân phiên — khuyến
// mãi đang áp dụng được ngay quan trọng hơn khuyến mãi còn phải chờ.
const STATUS_RANK = { ongoing: 0, upcoming: 1 };

/**
 * Banner đầu trang chủ — LUÂN PHIÊN các chương trình khuyến mãi "Sắp diễn
 * ra"/"Đang diễn ra" của TẤT CẢ ngành hàng (v14, Admin tạo ở /admin, xem
 * src/lib/promotions.js). Nếu CHƯA có khuyến mãi nào (project mới, Admin
 * chưa tạo gì) thì hiện khung placeholder "THÔNG TIN QUẢNG CÁO - KHUYẾN
 * MÃI" thay vì nội dung giới thiệu tĩnh cũ (đã bỏ — hay bị khung quảng cáo
 * đè lên/che mất khi có khuyến mãi thật), cùng kiểu khung "Chưa có sự
 * kiện" đã dùng ở IndustrySection.js cho đồng bộ toàn trang. 2 nút "Khám
 * phá sản phẩm"/"Tìm kiếm AI" luôn hiện NGAY DƯỚI banner, không đổi theo
 * trạng thái khuyến mãi.
 */
export default function HeroSection() {
  const { categoryPromotions, hydrated } = useShop();
  const [index, setIndex] = useState(0);

  const livePromotions = hydrated
    ? categoryPromotions
        .filter((p) => isPromotionLive(p))
        .sort((a, b) => STATUS_RANK[getPromotionStatus(a)] - STATUS_RANK[getPromotionStatus(b)])
    : [];

  useEffect(() => {
    if (livePromotions.length < 2) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % livePromotions.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cần chạy lại khi SỐ LƯỢNG khuyến mãi đổi, không phải mỗi khi tự động đổi index bên trong
  }, [livePromotions.length]);

  // Danh sách khuyến mãi có thể ngắn lại (Admin xoá bớt/hết hạn) khiến index
  // cũ vượt quá độ dài mới -> quay về đầu để không bị "treo" ngoài mảng.
  useEffect(() => {
    if (index >= livePromotions.length) setIndex(0);
  }, [livePromotions.length, index]);

  const activePromotion = livePromotions[index] || null;

  return (
    <section className="bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-16 sm:py-20 flex flex-col items-center text-center gap-6">
        {activePromotion ? (
          <div className="w-full max-w-4xl">
            <PromotionBanner promotion={activePromotion} />
            {livePromotions.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-3">
                {livePromotions.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Xem khuyến mãi ${p.title}`}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === index ? "bg-amber-600" : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="w-full max-w-4xl rounded-2xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center"
            style={{ aspectRatio: "3 / 1" }}
          >
            <p className="text-sm font-medium tracking-wide text-gray-400">
              THÔNG TIN QUẢNG CÁO - KHUYẾN MÃI
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mt-2">
          <Link
            href="/products"
            className="bg-gray-900 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-800 transition-colors"
          >
            Khám phá sản phẩm
          </Link>
          <Link
            href="/search"
            className="border border-gray-300 text-gray-900 px-6 py-3 rounded-md font-medium hover:bg-gray-50 transition-colors"
          >
            🤖 Tìm kiếm AI
          </Link>
        </div>
      </div>
    </section>
  );
}
