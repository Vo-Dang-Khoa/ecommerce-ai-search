"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "../providers";

export default function CartPage() {
  const { items, totalPrice, updateQty, removeItem, clearCart } = useCart();
  const [ordered, setOrdered] = useState(false);

  function handleCheckout() {
    clearCart();
    setOrdered(true);
  }

  if (ordered) {
    return (
      <main className="flex-1 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <p className="text-5xl mb-4">🎉</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Đặt hàng thành công!
          </h1>
          <p className="text-gray-600 mb-8">
            Đây là bản demo đồ án môn học, đơn hàng chưa được gửi tới hệ
            thống thật.
          </p>
          <Link
            href="/products"
            className="bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
          >
            Tiếp tục mua sắm
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Giỏ hàng</h1>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-6">Giỏ hàng của bạn đang trống.</p>
            <Link
              href="/products"
              className="bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
            >
              Khám phá sản phẩm
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 mb-8">
              {items.map(({ product, qty }) => (
                <div
                  key={product.id}
                  className="flex items-center gap-4 border border-gray-200 rounded-xl p-4"
                >
                  <span className="text-3xl">{product.emoji}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {product.price.toLocaleString("vi-VN")}đ / sản phẩm
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(product.id, qty - 1)}
                      className="w-8 h-8 rounded-md border border-gray-300 text-gray-700 hover:border-gray-900"
                    >
                      -
                    </button>
                    <span className="w-6 text-center">{qty}</span>
                    <button
                      onClick={() => updateQty(product.id, qty + 1)}
                      className="w-8 h-8 rounded-md border border-gray-300 text-gray-700 hover:border-gray-900"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-semibold text-gray-900 w-28 text-right">
                    {(product.price * qty).toLocaleString("vi-VN")}đ
                  </span>
                  <button
                    onClick={() => removeItem(product.id)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Xoá
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 pt-6">
              <span className="text-lg font-semibold text-gray-900">
                Tổng cộng: {totalPrice.toLocaleString("vi-VN")}đ
              </span>
              <button
                onClick={handleCheckout}
                className="bg-gray-900 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-800 transition-colors"
              >
                Đặt hàng
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
