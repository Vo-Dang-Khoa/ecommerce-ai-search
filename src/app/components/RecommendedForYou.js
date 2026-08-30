"use client";

import { useEffect, useState } from "react";
import ProductCard from "./ProductCard";
import { useShop, useOrders, useCart } from "../providers";
import { getRecommendations, getViewHistory } from "@/lib/recommendations";

/**
 * Mục "Gợi ý dành cho bạn" — dùng chung cho 3 vị trí (trang chủ, trang danh
 * sách sản phẩm, trang chi tiết sản phẩm), chỉ khác nhau qua props. Thuật
 * toán gợi ý (rule-based, không dùng AI) nằm ở src/lib/recommendations.js.
 *
 * @param {{
 *   title?: string,
 *   subtitle?: string,
 *   limit?: number,
 *   preferCategory?: string|null,
 *   excludeProductIds?: string[],
 * }} props
 */
export default function RecommendedForYou({
  title = "Gợi ý dành cho bạn",
  subtitle = "Dựa trên lịch sử mua hàng và sản phẩm bạn đã xem",
  limit = 8,
  preferCategory = null,
  excludeProductIds = [],
}) {
  const { allProducts, hydrated: shopHydrated } = useShop();
  const { orders, hydrated: ordersHydrated } = useOrders();
  const { items: cartItems } = useCart();

  // Lịch sử xem sản phẩm chỉ đọc được ở trình duyệt (localStorage) — đọc
  // trong useEffect để tránh lệch nội dung giữa server (SSR) và client lúc
  // hydrate (server luôn không có localStorage, trả về mảng rỗng).
  const [viewHistory, setViewHistory] = useState([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc lịch sử xem từ localStorage, chỉ có ở trình duyệt
    setViewHistory(getViewHistory());
  }, []);

  if (!shopHydrated || !ordersHydrated) return null;

  const recommendations = getRecommendations({
    allProducts,
    orders,
    cartItems,
    viewHistory,
    excludeProductIds,
    preferCategory,
    limit,
  });

  if (recommendations.length === 0) return null;

  return (
    <section>
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{title}</h2>
      {subtitle && <p className="text-gray-500 text-sm mb-6">{subtitle}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {recommendations.map(({ product, reason }) => (
          <ProductCard key={product.id} product={product} reason={reason} />
        ))}
      </div>
    </section>
  );
}
