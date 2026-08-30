"use client";

import { useState } from "react";
import Link from "next/link";
import { useShop } from "../../providers";
import ProductCard from "../../components/ProductCard";

// Tìm sản phẩm theo MÃ SẢN PHẨM — so khớp trực tiếp với id sản phẩm trong
// hệ thống, KHÔNG cần gọi AI (không tốn quota Gemini, luôn chạy được kể cả
// khi hết hạn mức miễn phí). Đây cũng là hàm nền cho tính năng quét mã
// vạch/QR bằng camera (sẽ làm ở bản cập nhật tiếp theo): khi camera quét
// ra 1 chuỗi mã, chuỗi đó sẽ được đưa qua ĐÚNG hàm tra cứu này.
//
// Lưu ý (đồ án demo): sản phẩm bánh demo chưa có mã vạch chuẩn quốc tế
// (EAN/UPC) như hàng hoá thật — mã dùng để tra cứu ở đây là "mã sản phẩm"
// nội bộ của ShopAI (vd "bsn-1"), xem được ngay trên URL trang chi tiết sản
// phẩm (/san-pham/bsn-1). Muốn test quét QR, có thể tự tạo mã QR chứa đúng
// chuỗi mã này bằng bất kỳ công cụ tạo QR miễn phí nào.
export function findProductByCode(allProducts, rawCode) {
  const code = String(rawCode || "").trim().toLowerCase();
  if (!code) return null;
  return allProducts.find((p) => String(p.id).toLowerCase() === code) || null;
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
          Nhập mã sản phẩm
        </label>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ví dụ: bsn-1"
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
