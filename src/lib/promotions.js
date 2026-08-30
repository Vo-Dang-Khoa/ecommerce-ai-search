// Chương trình khuyến mãi THEO NGÀNH HÀNG (v14, xem supabase/schema.sql mục
// 10) — do ADMIN tạo/sửa/xoá ở /admin, khác với banner gian hàng
// (src/lib/banners.js) do NGƯỜI BÁN tự quản lý. Mỗi ngành hàng (1 trong 12
// danh mục cha) chỉ có tối đa 1 khuyến mãi tại 1 thời điểm.
//
// Trạng thái "Sắp diễn ra"/"Đang diễn ra"/"Đã kết thúc" LUÔN được TÍNH TỰ
// ĐỘNG từ start_at/end_at ngay tại đây (không lưu sẵn 1 cột trạng thái
// trong DB) — tránh lệch dữ liệu nếu Admin quên cập nhật thủ công.

export const PROMOTION_STATUS_LABEL = {
  upcoming: "Sắp diễn ra",
  ongoing: "Đang diễn ra",
  ended: "Đã kết thúc",
};

/**
 * @param {{startAt: string, endAt: string}|null} promotion
 * @param {Date} [now]
 * @returns {"upcoming"|"ongoing"|"ended"|null}
 */
export function getPromotionStatus(promotion, now = new Date()) {
  if (!promotion) return null;
  const start = new Date(promotion.startAt);
  const end = new Date(promotion.endAt);
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "ongoing";
}

/**
 * true nếu khuyến mãi đang BẬT (active) và CHƯA KẾT THÚC (sắp diễn ra hoặc
 * đang diễn ra) — dùng để lọc banner hiển thị công khai ở trang chủ và
 * trang sản phẩm, tự động ẩn khuyến mãi đã tắt hoặc đã qua ngày kết thúc mà
 * không cần Admin phải vào xoá thủ công.
 *
 * @param {{active: boolean, startAt: string, endAt: string}|null} promotion
 * @param {Date} [now]
 */
export function isPromotionLive(promotion, now = new Date()) {
  if (!promotion || !promotion.active) return false;
  const status = getPromotionStatus(promotion, now);
  return status === "upcoming" || status === "ongoing";
}
