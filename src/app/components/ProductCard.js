"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "../providers";
import { getEffectivePrice, getProductImage } from "@/lib/shops";
import ProductQuickView from "./ProductQuickView";
import ClampedText from "./ClampedText";

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
    // h-full: khi đặt trong lưới (grid), CSS Grid đã tự kéo dãn các thẻ
    // trong CÙNG 1 HÀNG cao bằng nhau (hành vi mặc định "align-items:
    // stretch") — h-full + flex flex-col ở đây giúp PHẦN GIÁ + 3 NÚT HÀNH
    // ĐỘNG (mt-auto bên dưới) luôn dính SÁT ĐÁY thẻ, nhờ vậy chúng luôn
    // THẲNG HÀNG giữa các thẻ dù ảnh/tên/mô tả dài ngắn khác nhau.
    <div className="h-full border border-gray-200 rounded-xl p-5 flex flex-col gap-2 hover:border-gray-900 hover:shadow-md transition-all relative">
      {onSale && (
        <span className="absolute top-3 right-3 text-xs font-semibold bg-red-600 text-white rounded-full px-2 py-0.5">
          -{product.promotion.percent}%
        </span>
      )}
      {/* Bấm vào ảnh/tên -> sang trang chi tiết sản phẩm (/san-pham/[id]).
          Mô tả được TÁCH RIÊNG khỏi Link này (xem bên dưới) vì cần 1 nút
          "Xem thêm" độc lập — không được lồng <button> bên trong <a>/Link
          (sai chuẩn HTML). Ảnh dùng chiều cao CỐ ĐỊNH (h-32) và tên dùng
          ClampedText (chừa sẵn đúng 2 dòng, dù tên ngắn hay dài) để ô ảnh +
          tên luôn cùng kích cỡ giữa các thẻ. */}
      <Link href={`/san-pham/${product.id}`} className="flex flex-col gap-2">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URLs/arbitrary URLs, not optimizable by next/image
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-32 object-cover rounded-lg bg-amber-50 shrink-0"
          />
        ) : (
          <span className="text-4xl h-32 flex items-center justify-center shrink-0">
            {product.emoji}
          </span>
        )}
        <ClampedText
          as="h3"
          text={product.name}
          lines={2}
          textClassName="font-semibold text-gray-900 hover:underline"
          minHeightClass="min-h-[3rem]"
        />
        <p className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 w-fit truncate max-w-full">
          {product.category}
        </p>
      </Link>

      {/* Mô tả — chừa sẵn đúng 2 dòng (min-h-[2.5rem]) như trên, kèm nút
          "Xem thêm/Thu gọn" riêng khi mô tả dài hơn 2 dòng (xem
          ClampedText.js). */}
      {product.desc && (
        <ClampedText
          text={product.desc}
          lines={2}
          textClassName="text-sm text-gray-500"
          minHeightClass="min-h-[2.5rem]"
        />
      )}

      {reason && (
        <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
          🤖 {reason}
        </p>
      )}

      {/* mt-auto: dính sát đáy thẻ (xem ghi chú h-full ở trên) — giá và 3
          nút hành động vì vậy luôn CÙNG HÀNG, CÙNG KÍCH CỠ giữa các thẻ
          trong cùng 1 hàng lưới. */}
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <span className="font-semibold text-gray-900 flex items-center gap-2">
          {onSale && (
            <span className="text-xs text-gray-400 line-through font-normal">
              {product.price.toLocaleString("vi-VN")}đ
            </span>
          )}
          {effectivePrice.toLocaleString("vi-VN")}đ
        </span>

        {/* 3 nút hành động: "Xem nhanh" (đọc thêm thông tin sản phẩm, mở
            modal), "Mua ngay" (chỉ mua 1 sản phẩm này, vào thẳng /checkout),
            "Thêm vào giỏ" (mua nhiều sản phẩm, gom vào giỏ hàng trước) —
            grid-cols-3 đảm bảo 3 nút luôn cùng kích cỡ với nhau. */}
        <div className="grid grid-cols-3 gap-1.5">
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
