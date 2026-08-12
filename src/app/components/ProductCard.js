"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "../providers";
import { getEffectivePrice, getProductImage } from "@/lib/shops";
import ProductQuickView from "./ProductQuickView";

export default function ProductCard({ product, reason }) {
  const router = useRouter();
  const { addItem, buyNow } = useCart();
  const [added, setAdded] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const image = getProductImage(product);
  const effectivePrice = getEffectivePrice(product);
  const onSale = effectivePrice < product.price;

  function handleAdd() {
    addItem(product.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  // "Mua ngay": khách chỉ muốn mua đúng 1 sản phẩm này -> ghi nhớ tạm rồi
  // vào thẳng /checkout, không cần thêm vào giỏ hàng trước.
  function handleBuyNow() {
    buyNow(product.id, 1);
    router.push("/checkout");
  }

  return (
    <div className="border border-gray-200 rounded-xl p-5 flex flex-col gap-2 hover:border-gray-900 hover:shadow-md transition-all relative">
      {onSale && (
        <span className="absolute top-3 right-3 text-xs font-semibold bg-red-600 text-white rounded-full px-2 py-0.5">
          -{product.promotion.percent}%
        </span>
      )}
      {/* Bấm vào ảnh/tên/mô tả -> sang trang chi tiết sản phẩm
          (/san-pham/[id]), xem đầy đủ thông tin/mô tả. Tách riêng khỏi
          khung giá + 3 nút hành động bên dưới (không được lồng <button>
          bên trong <a>/Link — sai chuẩn HTML). */}
      <Link href={`/san-pham/${product.id}`} className="flex flex-col gap-2">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URLs/arbitrary URLs, not optimizable by next/image
          <img
            src={image}
            alt={product.name}
            className="w-full h-32 object-cover rounded-lg bg-amber-50"
          />
        ) : (
          <span className="text-4xl">{product.emoji}</span>
        )}
        <h3 className="font-semibold text-gray-900 hover:underline">{product.name}</h3>
        <p className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 w-fit">
          {product.category}
        </p>
        <p className="text-sm text-gray-500 flex-1">{product.desc}</p>
      </Link>
      {reason && (
        <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
          🤖 {reason}
        </p>
      )}

      <span className="font-semibold text-gray-900 flex items-center gap-2 mt-2">
        {onSale && (
          <span className="text-xs text-gray-400 line-through font-normal">
            {product.price.toLocaleString("vi-VN")}đ
          </span>
        )}
        {effectivePrice.toLocaleString("vi-VN")}đ
      </span>

      {/* 3 nút hành động: "Xem nhanh" (đọc thêm thông tin sản phẩm, mở
          modal), "Mua ngay" (chỉ mua 1 sản phẩm này, vào thẳng /checkout),
          "Thêm vào giỏ" (mua nhiều sản phẩm, gom vào giỏ hàng trước). */}
      <div className="grid grid-cols-3 gap-1.5 mt-1">
        <button
          type="button"
          onClick={() => setShowQuickView(true)}
          className="text-xs font-medium border border-gray-300 text-gray-700 rounded-md py-2 hover:border-gray-900 hover:text-gray-900 transition-colors"
        >
          Xem nhanh
        </button>
        <button
          type="button"
          onClick={handleBuyNow}
          className="text-xs font-medium bg-amber-600 text-white rounded-md py-2 hover:bg-amber-700 transition-colors"
        >
          Mua ngay
        </button>
        <button
          type="button"
          onClick={handleAdd}
          className="text-xs font-medium bg-gray-900 text-white rounded-md py-2 hover:bg-gray-800 transition-colors"
        >
          {added ? "Đã thêm ✓" : "Thêm vào giỏ"}
        </button>
      </div>

      {showQuickView && (
        <ProductQuickView
          product={product}
          onClose={() => setShowQuickView(false)}
        />
      )}
    </div>
  );
}
