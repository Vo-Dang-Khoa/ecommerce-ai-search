"use client";

import { useState } from "react";
import Link from "next/link";
import { useShop } from "../../providers";
import ProductCard from "../../components/ProductCard";

// Tìm sản phẩm theo MÃ VẠCH/MÃ QR — KHÔNG cần gọi AI (không tốn quota
// Gemini, luôn chạy được kể cả khi hết hạn mức miễn phí). Đây cũng là hàm
// nền cho tính năng quét mã vạch/QR bằng camera (BarcodeScannerClient.js):
// khi camera quét ra 1 chuỗi mã, chuỗi đó được đưa qua ĐÚNG hàm tra cứu này.
//
// v17: ưu tiên khớp với product.barcode — mã vạch/QR THẬT do seller tự gắn
// lúc đăng/sửa sản phẩm (in trên bao bì thật, vd EAN-13 "8938505970017"),
// xem BarcodeScanButton.js ở trang /seller/products/new và
// /seller/products/[id]. Nếu sản phẩm chưa gắn mã vạch thật, vẫn thử khớp
// theo id nội bộ (UUID) để không phá tính năng cho sản phẩm cũ chưa gắn mã.
export function findProductByCode(allProducts, rawCode) {
  const code = String(rawCode || "").trim().toLowerCase();
  if (!code) return null;
  return (
    allProducts.find((p) => p.barcode && String(p.barcode).trim().toLowerCase() === code) ||
    allProducts.find((p) => String(p.id).toLowerCase() === code) ||
    null
  );
}

export default function CodeSearchClient() {
  const { allProducts, hydrated } = useShop();
  const [code, setCode] = useState("");
  // undefined = chưa tìm lần nào, null = tìm nhưng không thấy, object = thấy
  const [result, setResult] = useState(undefined);

  function handleSubmit(e) {
    e.preventDefault();
    setResult(findProductByCode(allProducts, code));
  }

  return (
    <div className="max-w-md mx-auto text-left">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-4">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Nhập mã vạch / mã QR
        </label>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ví dụ: 8938505970017"
            className="flex-1 border border-gray-300 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            disabled={!hydrated || !code.trim()}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            Tìm
          </button>
        </div>
        {!hydrated && <p className="text-xs text-gray-400">Đang tải danh sách sản phẩm...</p>}
      </form>

      {result === null && (
        <p className="text-sm text-gray-500 mb-6">
          Không tìm thấy sản phẩm với mã &quot;{code}&quot;. Kiểm tra lại mã, hoặc dùng{" "}
          <Link href="/search" className="underline">
            tìm kiếm bằng văn bản
          </Link>
          .
        </p>
      )}

      {result && (
        <div className="mb-6">
          <ProductCard product={result} />
        </div>
      )}
    </div>
  );
}
