// Danh sách phương thức thanh toán/giao hàng dùng chung cho trang
// /checkout (lúc chọn) và trang /account (lúc hiển thị lại lịch sử đơn
// hàng), để nhãn hiển thị luôn khớp nhau ở cả 2 nơi.

export const PAYMENT_METHODS = [
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

export const SHIPPING_METHODS = [
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

export function paymentMethodLabel(id) {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label || id;
}

export function shippingMethodLabel(id) {
  return SHIPPING_METHODS.find((m) => m.id === id)?.label || id;
}
