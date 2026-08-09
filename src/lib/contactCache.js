// Lưu tạm số điện thoại/địa chỉ giao hàng của người mua vào trình duyệt
// (localStorage). Dùng làm phương án dự phòng khi chưa lưu được vào
// Supabase (vd: project chưa chạy supabase/schema.sql để thêm 2 cột
// phone/address vào bảng profiles), và để chia sẻ dữ liệu giữa trang
// /checkout và /account.
const CONTACT_CACHE_KEY = "shopai_checkout_contact";

export function readContactCache() {
  try {
    const raw = localStorage.getItem(CONTACT_CACHE_KEY);
    if (!raw) return { phone: "", address: "" };
    const parsed = JSON.parse(raw);
    return { phone: parsed.phone || "", address: parsed.address || "" };
  } catch {
    return { phone: "", address: "" };
  }
}

export function writeContactCache(contact) {
  try {
    localStorage.setItem(CONTACT_CACHE_KEY, JSON.stringify(contact));
  } catch {
    // ignore storage errors (vd: trình duyệt chặn localStorage)
  }
}
