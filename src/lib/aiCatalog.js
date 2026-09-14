// v17: dùng chung cho CẢ 4 route AI (api/chat, api/search, api/search-image,
// api/search-voice) — lấy TOÀN BỘ sản phẩm THẬT (mọi ngành hàng do mọi
// seller đăng bán, KHÔNG riêng bánh) từ Supabase để đưa vào prompt cho
// Gemini. Thay thế hoàn toàn cho catalog demo tĩnh cũ (PRODUCTS trong
// src/lib/products.js, chỉ có bánh) — ShopAI giờ là sàn TMĐT nhiều ngành
// hàng (thời trang, giày dép, đồ điện tử, mỹ phẩm, bánh ngọt...), không thể
// hardcode 1 ngành hàng cố định trong code được nữa.
//
// Đọc trực tiếp bằng anon key (không cần access_token của khách) vì bảng
// `products` có policy "Public can read products" (xem supabase/schema.sql
// mục 4) — giống hệt cách /api/notify-order đọc bảng `shops` công khai.
import { supabase } from "@/lib/supabaseClient";

// Giới hạn số sản phẩm đưa vào 1 lần gọi Gemini — tránh prompt quá dài (tốn
// quota + chậm) khi sàn có nhiều sản phẩm. 200 sản phẩm mới đăng gần nhất là
// đủ rộng cho quy mô demo đồ án, vẫn đại diện đủ các ngành hàng khác nhau.
const MAX_CATALOG_PRODUCTS = 200;

/**
 * Lấy danh sách sản phẩm THẬT (đã qua kiểm duyệt AI, moderation_status =
 * 'approved') từ Supabase, thuộc MỌI ngành hàng/gian hàng — dùng làm catalog
 * cho AI chọn/gợi ý. Trả về mảng rỗng (không throw) nếu lỗi, để 1 route AI
 * bị lỗi đọc DB tạm thời không làm sập cả tính năng — AI vẫn trả lời được,
 * chỉ là không gợi ý được sản phẩm cụ thể.
 */
export async function fetchCatalogProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, price, description")
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(MAX_CATALOG_PRODUCTS);

  if (error) {
    console.error("[aiCatalog] Không đọc được bảng products:", error);
    return [];
  }

  return (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    // Cột `category` (text) là tên ngành hàng/loại sản phẩm do seller tự
    // điền lúc đăng bán (vd "Giày nữ", "Bánh sinh nhật", "Điện thoại"...) —
    // KHÔNG giới hạn trước danh sách cố định nào, nên chatbot/tìm kiếm tự
    // nhiên "biết" hết mọi ngành hàng đang có trên sàn mà không cần sửa code
    // mỗi khi có ngành hàng mới.
    category: p.category || "",
    price: Number(p.price) || 0,
    desc: p.description || "",
  }));
}

/** Chuyển danh sách sản phẩm (từ fetchCatalogProducts) thành khối text đưa
 * vào prompt Gemini — dùng chung ở cả 4 route để đồng bộ định dạng. */
export function buildCatalogText(products) {
  if (!products || products.length === 0) {
    return "(Hiện sàn chưa có sản phẩm nào được đăng bán — hãy báo khách quay lại sau.)";
  }
  return products
    .map(
      (p) =>
        `- id: ${p.id} | ${p.name} | ngành hàng: ${p.category} | ${p.price.toLocaleString(
          "vi-VN"
        )}đ | ${p.desc}`
    )
    .join("\n");
}
