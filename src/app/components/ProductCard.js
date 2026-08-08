"use client";

import { useState } from "react";
import { useCart } from "../providers";

export default function ProductCard({ product, reason }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addItem(product.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="border border-gray-200 rounded-xl p-5 flex flex-col gap-2 hover:border-gray-900 hover:shadow-md transition-all">
      <span className="text-4xl">{product.emoji}</span>
      <h3 className="font-semibold text-gray-900">{product.name}</h3>
      <p className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 w-fit">
        {product.category}
      </p>
      <p className="text-sm text-gray-500 flex-1">{product.desc}</p>
      {reason && (
        <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
          🤖 {reason}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="font-semibold text-gray-900">
          {product.price.toLocaleString("vi-VN")}đ
        </span>
        <button
          onClick={handleAdd}
          className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
        >
          {added ? "Đã thêm ✓" : "Thêm vào giỏ"}
        </button>
      </div>
    </div>
  );
}
