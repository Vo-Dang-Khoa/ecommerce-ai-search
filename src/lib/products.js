// v17: đã bỏ dữ liệu sản phẩm demo tĩnh — trang web giờ chỉ hiển thị sản
// phẩm THẬT do seller tự đăng bán (lưu trong Supabase, bảng `products`, xem
// allProducts trong src/app/providers.js). Giữ lại CATEGORIES ở đây vì đây
// vẫn là danh sách 8 danh mục con gốc dùng để seed bảng `categories` trong
// supabase/schema.sql mục 9 (không xoá để tránh phải sửa lại file schema).
export const CATEGORIES = [
  "Bánh sinh nhật",
  "Bánh kem",
  "Cupcake",
  "Bánh mì & Croissant",
  "Donut",
  "Bánh quy",
  "Bánh Trung thu",
  "Bánh su kem",
];

// Không còn sản phẩm demo tĩnh nào — mảng để trống có chủ đích.
export const PRODUCTS = [];
