// Banner quảng cáo của gian hàng (v13, xem supabase/schema.sql mục 5D) —
// Người bán tự tạo 1 banner (tiêu đề, ảnh, tông màu) cho gian hàng mình,
// banner được hiển thị LUÂN PHIÊN GIỮA CÁC GIAN HÀNG ở nhiều trang (trang
// chủ, danh sách/danh mục sản phẩm, chi tiết sản phẩm) — xem hàm
// pickBanner() bên dưới, dùng ở src/app/components/AdSlot.js.

// Bộ tông màu GIỚI HẠN SẴN (không cho nhập mã màu tự do) — đảm bảo banner
// của bất kỳ gian hàng nào cũng hài hoà với giao diện chung của web (nền
// trắng/xám + điểm nhấn hổ phách) và luôn đủ tương phản để đọc chữ trắng
// đè lên ảnh, thay vì để người bán tự chọn màu dễ bị chói/khó đọc.
//   - swatch:  dùng cho nút chọn màu tròn ở form quản lý banner (/seller).
//   - overlay: dải gradient phủ lên ảnh banner để chữ luôn đọc được dù ảnh
//     nền sáng hay tối, đồng thời tạo cảm giác đồng bộ với tông đã chọn.
export const BANNER_THEMES = [
  {
    id: "amber",
    label: "Hổ phách (mặc định)",
    swatch: "from-amber-500 to-amber-700",
    overlay: "from-amber-900/90 via-amber-800/55 to-transparent",
  },
  {
    id: "rose",
    label: "Hồng đào",
    swatch: "from-rose-500 to-rose-700",
    overlay: "from-rose-900/90 via-rose-800/55 to-transparent",
  },
  {
    id: "emerald",
    label: "Ngọc lục bảo",
    swatch: "from-emerald-500 to-emerald-700",
    overlay: "from-emerald-900/90 via-emerald-800/55 to-transparent",
  },
  {
    id: "sky",
    label: "Xanh dương",
    swatch: "from-sky-500 to-sky-700",
    overlay: "from-sky-900/90 via-sky-800/55 to-transparent",
  },
  {
    id: "slate",
    label: "Đen sang trọng",
    swatch: "from-gray-700 to-gray-900",
    overlay: "from-gray-900/95 via-gray-900/70 to-transparent",
  },
];

export function getBannerTheme(themeId) {
  return BANNER_THEMES.find((t) => t.id === themeId) || BANNER_THEMES[0];
}

// Tỉ lệ khung ảnh banner (rộng : cao) — dùng làm `aspect` cho react-easy-crop
// (BannerImageUploader.js) và để gợi ý người bán chọn ảnh nằm ngang phù hợp
// với khung banner nằm dài trên các trang.
export const BANNER_ASPECT = 3;

/**
 * Chọn 1 banner để hiển thị tại 1 vị trí trên web — ưu tiên banner của
 * `preferShopId` (nếu gian hàng đó có banner đang bật), rồi mới tới banner
 * MỚI NHẤT đang bật trong toàn bộ hệ thống (tạo hiệu ứng "quảng cáo chéo"
 * giữa các gian hàng, giống các sàn TMĐT thật) — trả về null nếu chưa có
 * banner nào đang bật.
 *
 * @param {object[]} banners - danh sách banner đã tải (ShopContext.banners, đã sắp mới nhất trước)
 * @param {{preferShopId?: string|null, excludeShopId?: string|null}} opts
 * @returns {object|null}
 */
export function pickBanner(banners, { preferShopId = null, excludeShopId = null } = {}) {
  const active = (banners || []).filter((b) => b.active && b.shopId !== excludeShopId);
  if (active.length === 0) return null;
  if (preferShopId) {
    const preferred = active.find((b) => b.shopId === preferShopId);
    if (preferred) return preferred;
  }
  return active[0];
}
