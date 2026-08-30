"use client";

import { useState } from "react";
import ProductCard from "./ProductCard";
import PromotionBanner from "./PromotionBanner";

const VISIBLE_COUNT = 4;

/**
 * 1 khối "ngành hàng" ở trang /products — banner khuyến mãi RIÊNG của
 * ngành hàng đó ở trên cùng (hoặc "Chưa có sự kiện" nếu ngành hàng này Admin
 * chưa tạo khuyến mãi nào — xem PromotionBanner.js/src/lib/promotions.js),
 * NGAY DƯỚI là 4 ô sản phẩm với mũi tên trái/phải để lướt qua các sản phẩm
 * khác trong ngành hàng, và nút "Xem thêm"/"Thu gọn" để bung ra xem TOÀN BỘ
 * sản phẩm ngành hàng đó (dạng lưới đầy đủ) hoặc thu gọn lại về khung 4 ô.
 * Ô nào chưa có sản phẩm (ngành hàng mới/ít sản phẩm) hiện "Chưa có sản
 * phẩm" thay vì để trống trơn — người bán thêm sản phẩm vào sau sẽ tự động
 * lấp đầy đúng ô đó ở lần tải trang kế tiếp.
 *
 * @param {{title: string, products: object[], promotion: object|null}} props
 */
export default function IndustrySection({ title, products, promotion }) {
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const hasOverflow = products.length > VISIBLE_COUNT;
  const canScrollLeft = offset > 0;
  const canScrollRight = offset + VISIBLE_COUNT < products.length;
  const visibleProducts = products.slice(offset, offset + VISIBLE_COUNT);
  // Luôn chừa đủ 4 ô — ô nào chưa có sản phẩm để lấp thì hiện placeholder,
  // tránh khối ngành hàng này co lại ngắn hơn/lệch với các ngành hàng khác.
  const slots = Array.from({ length: VISIBLE_COUNT }, (_, i) => visibleProducts[i] || null);

  function scrollLeft() {
    setOffset((o) => Math.max(0, o - 1));
  }

  function scrollRight() {
    setOffset((o) => Math.min(Math.max(0, products.length - VISIBLE_COUNT), o + 1));
  }

  function toggleExpanded() {
    setExpanded((v) => !v);
    setOffset(0);
  }

  return (
    <section className="mb-14">
      <div className="mb-4">
        {promotion ? (
          <PromotionBanner promotion={promotion} />
        ) : (
          <div
            className="w-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center"
            style={{ aspectRatio: "3 / 1" }}
          >
            <p className="text-sm text-gray-400">Chưa có sự kiện</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {hasOverflow && !expanded && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={scrollLeft}
              disabled={!canScrollLeft}
              aria-label={`Xem sản phẩm trước trong ${title}`}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={scrollRight}
              disabled={!canScrollRight}
              aria-label={`Xem sản phẩm tiếp theo trong ${title}`}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div
        className={
          expanded
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            : "grid grid-cols-2 lg:grid-cols-4 gap-5"
        }
      >
        {(expanded ? products : slots).map((product, i) =>
          product ? (
            <ProductCard key={product.id} product={product} />
          ) : (
            <div
              key={`empty-${i}`}
              className="min-h-[280px] border border-dashed border-gray-200 rounded-xl flex items-center justify-center"
            >
              <p className="text-sm text-gray-400">Chưa có sản phẩm</p>
            </div>
          )
        )}
      </div>

      {hasOverflow && (
        <div className="text-center mt-5">
          <button
            type="button"
            onClick={toggleExpanded}
            className="text-sm font-medium text-amber-700 hover:text-amber-800"
          >
            {expanded ? "Thu gọn ▲" : "Xem thêm ▾"}
          </button>
        </div>
      )}
    </section>
  );
}
