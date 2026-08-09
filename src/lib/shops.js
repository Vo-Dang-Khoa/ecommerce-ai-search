import { supabase, PRODUCT_IMAGES_BUCKET } from "./supabaseClient";

export function genId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getEffectivePrice(product) {
  if (product?.promotion?.percent > 0) {
    const discounted =
      Math.round((product.price * (1 - product.promotion.percent / 100)) / 500) * 500;
    return Math.max(discounted, 0);
  }
  return product?.price ?? 0;
}

export function getProductImage(product) {
  return product?.images?.length > 0 ? product.images[0] : null;
}

/**
 * Tải 1 file ảnh lên Supabase Storage (bucket "product-images") và trả về
 * URL công khai để lưu vào cột `images` của bảng products.
 *
 * Thay thế cho fileToDataUrl() cũ (vốn nhúng ảnh dạng base64 vào localStorage
 * — không bền, không hiển thị được cho người dùng khác, dễ tràn dung lượng).
 *
 * @param {File} file - file ảnh người dùng chọn từ <input type="file">
 * @param {string} shopId - id gian hàng, dùng để tách thư mục ảnh theo shop
 * @returns {Promise<string>} URL công khai của ảnh vừa upload
 */
export async function uploadProductImage(file, shopId) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${shopId}/${genId("img")}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    throw new Error(`Tải ảnh lên Supabase thất bại: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
