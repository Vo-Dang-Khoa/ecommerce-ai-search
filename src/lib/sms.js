// Gửi thông báo "có đơn hàng mới" cho người bán bằng SMS THẬT — dùng app
// miễn phí, mã nguồn mở "SMS Gateway for Android" (https://sms-gate.app):
// cài lên 1 điện thoại Android (của người bán), app biến chính điện thoại đó
// thành 1 "cổng gửi SMS" — server chỉ cần gọi 1 API là điện thoại tự gửi SMS
// bằng SIM của nó. Không tốn phí dịch vụ ngoài (chỉ tốn cước SMS nội mạng
// của chính SIM đó, thường rất rẻ/đã có sẵn trong gói cước).
//
// Xem hướng dẫn cài đặt đầy đủ trong SMS_SETUP.md ở thư mục gốc dự án.
// Chỉ dùng ở phía SERVER (API route) — KHÔNG import từ component
// "use client" vì mật khẩu cổng SMS không được phép lộ ra trình duyệt.

// Máy chủ trung chuyển (cloud relay) MIỄN PHÍ do chính SMS Gateway for
// Android cung cấp — cho phép server gọi tới dù điện thoại không cùng
// mạng LAN/không có IP tĩnh (đúng nhu cầu 1 web đã deploy công khai gọi về
// điện thoại người bán ở bất kỳ đâu). Xem docs.sms-gate.app.
const SMS_GATEWAY_ENDPOINT = "https://api.sms-gate.app/3rdparty/v1/messages";

/**
 * Chuẩn hoá số điện thoại Việt Nam kiểu "0xxxxxxxxx" (cách người dùng nhập ở
 * trang /seller và /checkout) sang định dạng quốc tế E.164 "+84xxxxxxxxx" mà
 * API SMS Gateway yêu cầu. Trả về null nếu không parse được.
 */
export function toE164VN(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^0-9+]/g, "");
  if (digits.startsWith("+84")) return digits;
  if (digits.startsWith("84")) return `+${digits}`;
  if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
  return null;
}

/**
 * Gửi 1 tin nhắn SMS văn bản tới 1 số điện thoại.
 * LUÔN "fail soft" — không ném lỗi ra ngoài, chỉ trả về
 * { ok: false, error } để nơi gọi (route /api/notify-order) tự quyết định
 * cách xử lý, không để sự cố phía SMS Gateway làm hỏng luồng đặt hàng chính.
 *
 * @param {string} phone - số điện thoại (chấp nhận cả "0xxxxxxxxx" lẫn "+84xxxxxxxxx").
 * @param {string} text - Nội dung tin nhắn.
 * @returns {Promise<{ok: boolean, data?: any, error?: any}>}
 */
export async function sendSms(phone, text) {
  const e164 = toE164VN(phone);
  if (!e164) {
    return { ok: false, error: `Số điện thoại không hợp lệ: "${phone}".` };
  }

  const username = process.env.SMS_GATEWAY_USERNAME;
  const password = process.env.SMS_GATEWAY_PASSWORD;
  if (!username || !password) {
    return { ok: false, error: "Chưa cấu hình SMS_GATEWAY_USERNAME/SMS_GATEWAY_PASSWORD (xem SMS_SETUP.md)." };
  }

  try {
    const res = await fetch(SMS_GATEWAY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // API dùng HTTP Basic Auth với username/password lấy từ app trên
        // điện thoại (không phải tài khoản Google/email gì cả).
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      },
      body: JSON.stringify({
        textMessage: { text },
        phoneNumbers: [e164],
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[sms] Gửi SMS thất bại:", res.status, data);
      return { ok: false, error: data };
    }
    return { ok: true, data };
  } catch (err) {
    console.error("[sms] Lỗi khi gọi API SMS Gateway:", err.message);
    return { ok: false, error: err.message };
  }
}
