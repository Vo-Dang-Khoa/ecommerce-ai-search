"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useCart } from "../providers";
import { getEffectivePrice, getProductImage } from "@/lib/shops";

const PAYMENT_METHODS = [
  {
    id: "cod",
    label: "Thanh toán khi nhận hàng (COD)",
    desc: "Trả tiền mặt cho shipper khi nhận được hàng.",
  },
  {
    id: "bank",
    label: "Chuyển khoản ngân hàng",
    desc: "Chuyển khoản trước, đơn hàng được xử lý sau khi xác nhận thanh toán.",
  },
  {
    id: "ewallet",
    label: "Ví điện tử (Momo / ZaloPay)",
    desc: "Quét mã QR thanh toán qua ví điện tử.",
  },
];

const SHIPPING_METHODS = [
  {
    id: "standard",
    label: "Giao hàng tiêu chuẩn",
    desc: "Nhận hàng sau 2-3 ngày.",
    fee: 20000,
  },
  {
    id: "express",
    label: "Giao hàng nhanh",
    desc: "Nhận hàng trong ngày.",
    fee: 40000,
  },
];

const PHONE_REGEX = /^(0|\+84)[3-9][0-9]{8}$/;

export default function CheckoutPage() {
  const router = useRouter();
  const { user, hydrated: authHydrated, updateProfile } = useAuth();
  const { items, totalPrice, clearCart } = useCart();

  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Chưa đăng nhập mà vào thẳng /checkout (gõ URL, back/forward...) -> đưa
  // về trang "Người mua đăng nhập", đăng nhập xong quay lại đây.
  useEffect(() => {
    if (authHydrated && !user) {
      router.replace("/login?role=buyer&redirect=/checkout");
    }
  }, [authHydrated, user, router]);

  // Điền sẵn số điện thoại/địa chỉ đã lưu từ lần đặt hàng trước (nếu có).
  useEffect(() => {
    if (user) {
      setAddress(user.address || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  const shippingFee =
    SHIPPING_METHODS.find((m) => m.id === shippingMethod)?.fee ?? 0;
  const grandTotal = totalPrice + shippingFee;

  async function handleConfirm(e) {
    e.preventDefault();
    if (!address.trim()) {
      setError("Vui lòng nhập địa chỉ giao hàng.");
      return;
    }
    if (!PHONE_REGEX.test(phone.trim())) {
      setError("Số điện thoại không hợp lệ.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      // Lưu lại địa chỉ/số điện thoại vào hồ sơ để lần đặt hàng sau tự điền.
      await updateProfile({ phone: phone.trim(), address: address.trim() });
      clearCart();
      setSuccess(true);
    } catch (err) {
      setError(err?.message || "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    const payment = PAYMENT_METHODS.find((m) => m.id === paymentMethod);
    const shipping = SHIPPING_METHODS.find((m) => m.id === shippingMethod);
    return (
      <main className="flex-1 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <p className="text-5xl mb-4">🎉</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Đặt hàng thành công!
          </h1>
          <p className="text-gray-600 mb-2">
            Thanh toán: {payment?.label} · Giao hàng: {shipping?.label}
          </p>
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

  // Chưa xác định xong đăng nhập, hoặc đang chờ điều hướng về /login.
  if (!authHydrated || !user) {
    return <main className="flex-1 bg-white" />;
  }

  if (items.length === 0) {
    return (
      <main className="flex-1 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <p className="text-gray-500 mb-6">
            Giỏ hàng của bạn đang trống, chưa có gì để đặt hàng.
          </p>
          <Link
            href="/products"
            className="bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
          >
            Khám phá sản phẩm
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Thanh toán đơn hàng
        </h1>

        <form
          onSubmit={handleConfirm}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          <div className="md:col-span-2 flex flex-col gap-8">
            {/* Địa chỉ giao hàng + số điện thoại liên hệ */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Thông tin nhận hàng
              </h2>
              <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Địa chỉ giao hàng
                  </label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09xxxxxxxx"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
                  />
                </div>
              </div>
            </section>

            {/* Phương thức thanh toán */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Phương thức thanh toán
              </h2>
              <div className="flex flex-col gap-3">
                {PAYMENT_METHODS.map((method) => (
                  <label
                    key={method.id}
                    className={`flex items-start gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${
                      paymentMethod === method.id
                        ? "border-gray-900"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={paymentMethod === method.id}
                      onChange={() => setPaymentMethod(method.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium text-gray-900">
                        {method.label}
                      </span>
                      <span className="block text-sm text-gray-500">
                        {method.desc}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* Phương thức giao hàng */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Phương thức giao hàng
              </h2>
              <div className="flex flex-col gap-3">
                {SHIPPING_METHODS.map((method) => (
                  <label
                    key={method.id}
                    className={`flex items-start gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${
                      shippingMethod === method.id
                        ? "border-gray-900"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={method.id}
                      checked={shippingMethod === method.id}
                      onChange={() => setShippingMethod(method.id)}
                      className="mt-1"
                    />
                    <span className="flex-1">
                      <span className="block font-medium text-gray-900">
                        {method.label}
                      </span>
                      <span className="block text-sm text-gray-500">
                        {method.desc}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {method.fee.toLocaleString("vi-VN")}đ
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          {/* Tóm tắt đơn hàng + nút xác nhận */}
          <div>
            <div className="border border-gray-200 rounded-xl p-4 sticky top-20 flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Đơn hàng ({items.length} sản phẩm)
              </h2>

              <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
                {items.map(({ product, qty }) => {
                  const image = getProductImage(product);
                  const unitPrice = getEffectivePrice(product);
                  return (
                    <div key={product.id} className="flex items-center gap-3">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URLs/arbitrary URLs
                        <img
                          src={image}
                          alt={product.name}
                          className="w-10 h-10 object-cover rounded-md bg-amber-50 shrink-0"
                        />
                      ) : (
                        <span className="text-2xl shrink-0">{product.emoji}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {qty} x {unitPrice.toLocaleString("vi-VN")}đ
                        </p>
                      </div>
                      <span className="text-sm font-medium text-gray-900 shrink-0">
                        {(unitPrice * qty).toLocaleString("vi-VN")}đ
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-gray-100 pt-4 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Tạm tính</span>
                  <span>{totalPrice.toLocaleString("vi-VN")}đ</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Phí vận chuyển</span>
                  <span>{shippingFee.toLocaleString("vi-VN")}đ</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-gray-900 pt-1.5 border-t border-gray-100 mt-1.5">
                  <span>Tổng cộng</span>
                  <span>{grandTotal.toLocaleString("vi-VN")}đ</span>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="bg-gray-900 text-white py-3 rounded-md font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Đang xử lý..." : "Xác nhận đặt hàng"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
