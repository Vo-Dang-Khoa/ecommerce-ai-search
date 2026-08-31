"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useCart } from "../providers";
import { getEffectivePrice, getProductImage } from "@/lib/shops";

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, totalPrice, updateQty, removeItem } = useCart();

  // Bấm "Đặt hàng": chưa đăng nhập -> điều hướng sang trang "Người mua
  // đăng nhập" (kèm redirect=/checkout để đăng nhập/đăng ký xong quay
  // thẳng lại bước thanh toán). Đã đăng nhập -> vào thẳng /checkout để
  // chọn phương thức thanh toán, giao hàng và xác nhận đơn.
  function handleCheckout() {
    if (!user) {
      router.push("/login?role=buyer&redirect=/checkout");
      return;
    }
    router.push("/checkout");
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
              {items.map(({ product, qty }) => {
                const image = getProductImage(product);
                const unitPrice = getEffectivePrice(product);
                return (
                  <div
                    key={product.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border border-gray-200 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URLs/arbitrary URLs
                        <img
                          src={image}
                          alt={product.name}
                          loading="lazy"
                          decoding="async"
                          className="w-12 h-12 object-cover rounded-md bg-amber-50 shrink-0"
                        />
                      ) : (
                        <span className="text-3xl shrink-0">{product.emoji}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {product.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {unitPrice.toLocaleString("vi-VN")}đ / sản phẩm
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => updateQty(product.id, qty - 1)}
                          className="w-9 h-9 sm:w-8 sm:h-8 rounded-md border border-gray-300 text-gray-700 hover:border-gray-900"
                        >
                          -
                        </button>
                        <span className="w-6 text-center">{qty}</span>
                        <button
                          onClick={() => updateQty(product.id, qty + 1)}
                          className="w-9 h-9 sm:w-8 sm:h-8 rounded-md border border-gray-300 text-gray-700 hover:border-gray-900"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-semibold text-gray-900 sm:w-28 sm:text-right shrink-0">
                        {(unitPrice * qty).toLocaleString("vi-VN")}đ
                      </span>
                      <button
                        onClick={() => removeItem(product.id)}
                        className="text-sm text-red-600 hover:text-red-700 shrink-0"
                      >
                        Xoá
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-gray-200 pt-6">
              <span className="text-lg font-semibold text-gray-900">
                Tổng cộng: {totalPrice.toLocaleString("vi-VN")}đ
              </span>
              <button
                onClick={handleCheckout}
                className="w-full sm:w-auto bg-gray-900 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-800 transition-colors"
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
