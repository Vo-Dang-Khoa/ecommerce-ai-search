// API báo "có đơn hàng mới" cho Người bán qua SMS — được trang /checkout
// gọi (fetch, không chờ/không chặn) NGAY SAU KHI đơn hàng đã được lưu thành
// công vào Supabase (orders/order_items), xem handleConfirm() trong
// src/app/checkout/page.js.
//
// Cùng triết lý "không chặn luồng chính vì 1 tính năng phụ trợ" như
// /api/moderate-product và việc lưu profile ở /checkout: route này LUÔN trả
// về 200 (trừ lỗi input rõ ràng) — thất bại khi gửi SMS chỉ được ghi log,
// không ảnh hưởng gì tới việc khách đã đặt hàng thành công.
//
// Route KHÔNG tự đọc lại đơn hàng từ Supabase (bảng orders có RLS chỉ cho
// buyer_id/seller xem đơn của mình, mà request server-to-server này không
// có access token đăng nhập của khách) — thay vào đó, client gửi kèm sẵn
// toàn bộ thông tin cần thiết trong body. Route chỉ cần đọc bảng `shops`
// (policy "Public can read shops" cho phép đọc công khai) để lấy số điện
// thoại (cột phone, đã có sẵn từ trước) của (các) gian hàng có sản phẩm
// trong đơn — xem SMS_SETUP.md để cấu hình cổng gửi SMS.
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { sendSms } from "@/lib/sms";
import { paymentMethodLabel, shippingMethodLabel } from "@/lib/orderOptions";
import { checkRateLimit, getClientIp } from "@/lib/security";

function formatCurrency(n) {
  return `${Number(n || 0).toLocaleString("vi-VN")}đ`;
}

function buildMessage({ orderId, total, address, paymentMethod, shippingMethod, shopName }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const shortId = orderId ? String(orderId).slice(0, 8) : "?";
  const lines = [
    `[ShopAI] Don hang moi${shopName ? ` - ${shopName}` : ""}`,
    `Ma don: #${shortId}`,
    `Tong tien: ${formatCurrency(total)}`,
    `Thanh toan: ${paymentMethodLabel(paymentMethod)}`,
    `Giao hang: ${shippingMethodLabel(shippingMethod)}`,
    `Dia chi: ${address || "?"}`,
    siteUrl ? `Xem tai ${siteUrl}/seller` : "Vao /seller de xu ly.",
  ];
  // SMS thường/không dấu (GSM-7) rẻ hơn và ít bị nhà mạng chia nhỏ thành
  // nhiều tin hơn SMS có dấu tiếng Việt (Unicode) — nên bỏ dấu cho gọn.
  return lines.join(". ");
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nội dung yêu cầu không hợp lệ." }, { status: 400 });
  }

  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  const total = Number(body?.total) || 0;
  const address = typeof body?.address === "string" ? body.address.slice(0, 500) : "";
  const paymentMethod = typeof body?.paymentMethod === "string" ? body.paymentMethod : "";
  const shippingMethod = typeof body?.shippingMethod === "string" ? body.shippingMethod : "";
  // shopIds: danh sách shop_id (không trùng lặp) có sản phẩm trong đơn hàng
  // này — lấy từ product.shopId phía client (xem checkout/page.js).
  const shopIds = Array.isArray(body?.shopIds)
    ? [...new Set(body.shopIds.filter((id) => typeof id === "string" && id))].slice(0, 20)
    : [];

  if (!orderId) {
    return NextResponse.json({ error: "Thiếu orderId." }, { status: 400 });
  }

  // Giới hạn số lần gọi theo IP — đây là API "best-effort", không cần chặt
  // như /api/moderate-product, chỉ để tránh 1 client lỗi/cố ý gọi lặp lại
  // làm tốn cước SMS của điện thoại người bán.
  const clientIp = getClientIp(request);
  const rate = checkRateLimit(`notify-order:${clientIp}`, { limit: 10, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Quá nhiều yêu cầu, vui lòng thử lại sau." }, { status: 429 });
  }

  // Chưa cấu hình cổng SMS (vd sinh viên chưa làm theo SMS_SETUP.md) -> báo
  // rõ trong log server để dễ debug, nhưng vẫn trả 200 vì đây là tính năng phụ.
  if (!process.env.SMS_GATEWAY_USERNAME || !process.env.SMS_GATEWAY_PASSWORD) {
    console.warn("[notify-order] Bỏ qua: chưa cấu hình SMS_GATEWAY_USERNAME/SMS_GATEWAY_PASSWORD.");
    return NextResponse.json({ ok: true, skipped: true, reason: "sms-not-configured" });
  }

  // Lấy tên + số điện thoại của các gian hàng liên quan (bảng shops đọc
  // công khai được, xem policy "Public can read shops" trong
  // supabase/schema.sql).
  let targets = [];
  if (shopIds.length > 0) {
    const { data: shopRows, error } = await supabase
      .from("shops")
      .select("id, name, phone")
      .in("id", shopIds);
    if (error) {
      console.error("[notify-order] Không đọc được bảng shops:", error);
    } else {
      targets = (shopRows || []).map((s) => ({
        phone: s.phone || process.env.SMS_DEFAULT_PHONE || "",
        shopName: s.name,
      }));
    }
  }

  // Không xác định được gian hàng nào (vd lỗi đọc shops, hoặc đơn hàng test
  // không có shopIds) -> vẫn cố gửi 1 SMS về SMS_DEFAULT_PHONE nếu có, để
  // chủ web (thường cũng là người bán demo) vẫn nhận được thông báo.
  if (targets.length === 0 && process.env.SMS_DEFAULT_PHONE) {
    targets = [{ phone: process.env.SMS_DEFAULT_PHONE, shopName: "" }];
  }

  // Nhiều sản phẩm trong đơn có thể cùng 1 gian hàng, hoặc nhiều gian hàng
  // dùng chung 1 số điện thoại (demo 1 người bán) -> gửi tối đa 1 SMS/số,
  // tránh spam trùng lặp + tốn cước 2 lần.
  const seen = new Set();
  const uniqueTargets = targets.filter((t) => {
    if (!t.phone || seen.has(t.phone)) return false;
    seen.add(t.phone);
    return true;
  });

  if (uniqueTargets.length === 0) {
    console.warn(`[notify-order] Đơn #${orderId}: không có số điện thoại nào để gửi SMS (gian hàng chưa có số điện thoại và cũng chưa có SMS_DEFAULT_PHONE).`);
    return NextResponse.json({ ok: true, skipped: true, reason: "no-recipient" });
  }

  const results = await Promise.all(
    uniqueTargets.map((t) =>
      sendSms(
        t.phone,
        buildMessage({ orderId, total, address, paymentMethod, shippingMethod, shopName: t.shopName })
      )
    )
  );

  return NextResponse.json({
    ok: true,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
}
