"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "../providers";
import { getEffectivePrice, getProductImage } from "@/lib/shops";

// Modal "Xem nhanh": hiện đầy đủ thông tin sản phẩm (ảnh, mô tả, thuộc
// tính...) ngay trên trang danh sách, không cần trang chi tiết riêng. Cho
// phép chọn số lượng rồi "Thêm vào giỏ" hoặc "Mua ngay" luôn trong modal.
export default function ProductQuickView({ product, onClose }) {
  const router = useRouter();
  const { addItem, buyNow } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const image = getProductImage(product);
  const effectivePrice = getEffectivePrice(product);
  const onSale = effectivePrice < product.price;
  const attributes = product.attributes || [];

  // Đóng modal khi bấm phím Esc, tiện hơn cho người dùng bàn phím.
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleAdd() {
    addItem(product.id, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  function handleBuyNow() {
    buyNow(product.id, qty);
    onClose();
    router.push("/checkout");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-lg w-full max-h-full overflow-y-auto p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          ✕
        </button>

        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URLs/arbitrary URLs
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-48 object-cover rounded-lg bg-amber-50 mb-4"
          />
        ) : (
          <div className="w-full h-48 flex items-center justify-center bg-amber-50 rounded-lg mb-4">
            <span className="text-6xl">{product.emoji}</span>
          </div>
        )}

        <p className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 w-fit mb-2">
          {product.category}
        </p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h2>

        <span className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
          {onSale && (
            <span className="text-sm text-gray-400 line-through font-normal">
              {product.price.toLocaleString("vi-VN")}đ
            </span>
          )}
          <span className="text-lg">{effectivePrice.toLocaleString("vi-VN")}đ</span>
          {onSale && (
            <span className="text-xs font-semibold bg-red-600 text-white rounded-full px-2 py-0.5">
              -{product.promotion.percent}%
            </span>
          )}
        </span>

        {product.desc && (
          <p className="text-sm text-gray-600 mb-4">{product.desc}</p>
        )}

        {attributes.length > 0 && (
          <div className="border border-gray-100 bg-gray-50 rounded-lg p-3 mb-4 flex flex-col gap-1.5">
            {attributes.map((attr, i) => (
              <div key={i} className="flex text-sm">
                <span className="text-gray-500 w-28 shrink-0">{attr.key}</span>
                <span className="text-gray-900">{attr.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-700">Số lượng</span>
          <div className="flex items-center border border-gray-300 rounded-md">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50"
            >
              −
            </button>
            <span className="w-8 text-center text-sm">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50"
            >
              +
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleAdd}
            className="text-sm font-medium border border-gray-900 text-gray-900 rounded-md py-2.5 hover:bg-gray-50 transition-colors"
          >
            {added ? "Đã thêm ✓" : "Thêm vào giỏ"}
          </button>
          <button
            type="button"
            onClick={handleBuyNow}
            className="text-sm font-medium bg-amber-600 text-white rounded-md py-2.5 hover:bg-amber-700 transition-colors"
          >
            Mua ngay
          </button>
        </div>
      </div>
    </div>
  );
}
