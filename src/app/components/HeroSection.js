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
 * chưa tạo gì) thì tự quay lại nội dung giới thiệu tĩnh mặc định, tránh
 * trang chủ bị "trống" phần đầu. 2 nút "Khám phá sản phẩm"/"Tìm kiếm AI"
 * luôn hiện NGAY DƯỚI banner, không đổi theo trạng thái khuyến mãi.
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
          <>
            <span className="text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
              Tiệm bánh trực tuyến #1 với tìm kiếm AI
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 max-w-2xl leading-tight">
              Bánh ngon mỗi ngày,
              <br />
              ngọt ngào từng khoảnh khắc
            </h1>
            <p className="text-lg text-gray-600 max-w-xl">
              Từ bánh sinh nhật, bánh kem cho đến bánh mì mỗi sáng — chọn đúng
              loại bánh bạn thích chỉ trong vài giây nhờ trợ lý tìm kiếm AI.
            </p>
          </>
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
