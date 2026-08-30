import { supabase, PRODUCT_IMAGES_BUCKET, PRODUCT_VIDEOS_BUCKET } from "./supabaseClient";

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

// Kích thước/dung lượng ảnh sản phẩm mong muốn trên trang web — ảnh lớn
// hơn sẽ được TỰ ĐỘNG thu nhỏ (giữ đúng tỉ lệ) trước khi tải lên, thay vì
// từ chối thẳng như trước đây. 1600px đủ nét cho mọi vị trí hiển thị hiện
// tại của web (thẻ sản phẩm, trang chi tiết, ảnh phóng to).
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;

/**
 * Đọc kích thước thật (width/height) của 1 file ảnh, không cần gắn vào DOM.
 */
function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight, url, img });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh, tệp có thể bị hỏng."));
    };
    img.src = url;
  });
}

/**
 * Thu nhỏ + nén lại 1 file ảnh nếu nó vượt quá kích thước/dung lượng cho
 * phép — dùng canvas (chạy hoàn toàn trên trình duyệt, không cần thư viện
 * ngoài). Nếu ảnh đã đủ nhỏ, trả về nguyên bản (không nén lại, giữ chất
 * lượng gốc).
 *
 * @param {File} file - file ảnh gốc người dùng chọn
 * @returns {Promise<File>} file ảnh đã (có thể) được thu nhỏ, sẵn sàng để upload
 */
export async function resizeImageFile(file) {
  const { width, height, url, img } = await readImageDimensions(file);

  const withinDimension = width <= IMAGE_MAX_DIMENSION && height <= IMAGE_MAX_DIMENSION;
  if (withinDimension && file.size <= IMAGE_MAX_BYTES) {
    URL.revokeObjectURL(url);
    return file; // Đã đủ nhỏ, không cần xử lý gì thêm.
  }

  const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(width, height));
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  canvas.getContext("2d").drawImage(img, 0, 0, targetWidth, targetHeight);
  URL.revokeObjectURL(url);

  // Giảm dần chất lượng JPEG cho tới khi vừa dung lượng cho phép (hoặc chạm
  // mức thấp nhất chấp nhận được, tránh ảnh bị vỡ nét quá mức).
  let quality = 0.85;
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  while (blob && blob.size > IMAGE_MAX_BYTES && quality > 0.4) {
    quality -= 0.15;
    // eslint-disable-next-line no-await-in-loop -- cần đợi từng bước giảm chất lượng để kiểm tra lại dung lượng
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  }
  if (!blob) return file; // Trường hợp hiếm canvas không xuất được -> dùng tạm bản gốc.

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
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

// v12: giới hạn video giới thiệu sản phẩm — kiểm tra ở TRÌNH DUYỆT trước
// khi tải lên, báo lỗi rõ ràng kèm hướng dẫn khắc phục thay vì cố tự động
// nén video (nén video thật sự trong trình duyệt rất phức tạp, dễ treo máy
// yếu/trình duyệt cũ — không phù hợp cho đồ án demo cần chạy ổn định).
export const VIDEO_MAX_SECONDS = 60;
export const VIDEO_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Đọc thời lượng (giây) của 1 file video, không cần gắn vào DOM.
 */
export function readVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được video, tệp có thể bị hỏng hoặc sai định dạng."));
    };
    video.src = url;
  });
}

/**
 * Kiểm tra 1 file video có nằm trong giới hạn cho phép không — trả về
 * thông báo lỗi kèm hướng dẫn khắc phục cụ thể nếu vượt quá, hoặc null nếu
 * hợp lệ.
 *
 * @param {File} file
 * @returns {Promise<string|null>}
 */
export async function validateProductVideo(file) {
  if (file.size > VIDEO_MAX_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return (
      `Video nặng ${sizeMb}MB, vượt quá ${VIDEO_MAX_BYTES / (1024 * 1024)}MB cho phép. ` +
      `Hãy giảm dung lượng trước khi tải lên: dùng ứng dụng cắt/nén video có sẵn trên điện ` +
      `thoại (giảm độ phân giải hoặc chất lượng), hoặc công cụ nén video miễn phí trên máy tính.`
    );
  }

  let duration;
  try {
    duration = await readVideoDuration(file);
  } catch (err) {
    return err.message;
  }

  if (duration > VIDEO_MAX_SECONDS) {
    const seconds = Math.round(duration);
    return (
      `Video dài ${seconds} giây, vượt quá ${VIDEO_MAX_SECONDS} giây cho phép. ` +
      `Hãy cắt bớt video (gợi ý: chỉ giữ lại đoạn giới thiệu sản phẩm rõ nét nhất, khoảng ` +
      `${VIDEO_MAX_SECONDS} giây đầu) bằng ứng dụng cắt video có sẵn trên điện thoại, rồi tải ` +
      `lại đoạn đã cắt.`
    );
  }

  return null;
}

/**
 * Tải 1 file video lên Supabase Storage (bucket "product-videos") và trả
 * về URL công khai để lưu vào cột `video_url` của bảng products. Gọi
 * validateProductVideo() TRƯỚC hàm này để chặn video vượt giới hạn.
 *
 * @param {File} file - file video người dùng chọn từ <input type="file">
 * @param {string} shopId - id gian hàng, dùng để tách thư mục video theo shop
 * @returns {Promise<string>} URL công khai của video vừa upload
 */
export async function uploadProductVideo(file, shopId) {
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const path = `${shopId}/${genId("vid")}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_VIDEOS_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    throw new Error(`Tải video lên Supabase thất bại: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(PRODUCT_VIDEOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
