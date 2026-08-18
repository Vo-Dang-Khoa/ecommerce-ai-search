// Helper dùng chung cho các tính năng "tích hợp AI trong bảo mật":
//  1. checkRateLimit()/getClientIp() — giới hạn số lần gọi API AI theo IP,
//     chống lạm dụng (spam request tốn phí Anthropic, hoặc tấn công
//     prompt injection dồn dập). Dùng ở cả /api/search (đã có từ trước) và
//     /api/moderate-product (mới).
//  2. moderateProductContent() — gọi AI kiểm duyệt tên/danh mục/mô tả sản
//     phẩm TRƯỚC khi cho phép người bán đăng công khai, chặn hàng cấm/dấu
//     hiệu lừa đảo/spam. Dùng ở trang /seller/products/new.

// LƯU Ý QUAN TRỌNG: rateLimitBuckets là Map lưu trong bộ nhớ (RAM) của 1
// tiến trình server — chỉ đúng trong phạm vi 1 serverless instance đang
// "ấm" (warm), KHÔNG phải rate limit phân tán thật sự giữa nhiều instance
// (Vercel có thể định tuyến các request tới các instance khác nhau). Đây
// là mức bảo vệ CƠ BẢN, phù hợp quy mô đồ án demo. Muốn chuẩn production
// (chặn chính xác across mọi instance) cần dịch vụ ngoài như Vercel KV
// hoặc Upstash Redis — nằm ngoài phạm vi đồ án này.
const rateLimitBuckets = new Map();

function cleanupExpiredBuckets() {
  // Chỉ dọn khi Map phình to, tránh tốn CPU mỗi lần gọi.
  if (rateLimitBuckets.size < 5000) return;
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets) {
    if (now > bucket.resetAt) rateLimitBuckets.delete(key);
  }
}

/**
 * Giới hạn số lần gọi trong 1 khoảng thời gian, theo key bất kỳ (thường là
 * `${tên API}:${ip}`). Trả về { allowed, remaining, retryAfterMs }.
 */
export function checkRateLimit(key, { limit = 10, windowMs = 60_000 } = {}) {
  cleanupExpiredBuckets();
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}

/** Lấy địa chỉ IP người gọi từ header do Vercel/proxy gắn vào request. */
export function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Gọi API /api/moderate-product để AI kiểm tra nội dung sản phẩm trước khi
 * cho đăng bán. FAIL OPEN khi dịch vụ AI lỗi/chưa cấu hình ANTHROPIC_API_KEY
 * (trả allowed=true, chỉ cảnh báo console) — giống cách các lỗi phụ khác
 * trong dự án (vd lưu profile ở /checkout) KHÔNG được chặn tính năng cốt
 * lõi (đăng sản phẩm) chỉ vì 1 dịch vụ phụ trợ gặp sự cố.
 *
 * @param {{name: string, category: string, desc: string}} product
 * @returns {Promise<{allowed: boolean, reason: string, skipped: boolean}>}
 */
export async function moderateProductContent({ name, category, desc }) {
  try {
    const res = await fetch("/api/moderate-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, desc }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.warn(
        "[moderateProductContent] Kiểm duyệt AI lỗi, tạm bỏ qua (fail open):",
        data?.error
      );
      return { allowed: true, reason: "", skipped: true };
    }

    return { allowed: data.allowed !== false, reason: data.reason || "", skipped: false };
  } catch (err) {
    console.warn(
      "[moderateProductContent] Không gọi được API kiểm duyệt, tạm bỏ qua (fail open):",
      err
    );
    return { allowed: true, reason: "", skipped: true };
  }
}
