# Hướng dẫn cấu hình thông báo đơn hàng mới qua SMS (miễn phí)

Tính năng: khi khách đặt hàng thành công, hệ thống tự động gửi 1 tin nhắn
**SMS thật** báo "có đơn hàng mới" tới số điện thoại của người bán, để vào
`/seller` xử lý.

## Vì sao không dùng Zalo?

Đã thử hướng Zalo OA trước đó nhưng phát hiện: Zalo hiện **chỉ cho phép
nhắn tin qua OA khi đã có Giấy phép đăng ký kinh doanh/Hộ kinh doanh** —
không có cách nào nhắn tin miễn phí mà không cần giấy tờ. Vì đồ án không
có kinh phí/giấy phép kinh doanh, chuyển sang **SMS thật** — dùng app miễn
phí, mã nguồn mở **SMS Gateway for Android** (https://sms-gate.app,
https://github.com/capcom6/android-sms-gateway).

**Cách hoạt động:** cài 1 app lên điện thoại Android của người bán (chính
điện thoại đó gửi SMS thật bằng SIM của mình). Backend chỉ cần gọi 1 API
là điện thoại tự động gửi SMS — không qua dịch vụ SMS trung gian nào tính
phí. Chi phí duy nhất là cước SMS nội mạng của SIM đó (thường rất rẻ hoặc
đã có sẵn trong gói cước, không đáng kể cho vài chục tin nhắn demo).

## Bước 1 — Cài app SMS Gateway for Android

1. Trên **điện thoại Android của người bán** (máy có SIM, dùng để nhận
   SMS thông báo), tải app tại:
   https://github.com/capcom6/android-sms-gateway/releases (file `.apk`,
   hoặc tìm "SMS Gateway for Android" trên Google Play nếu có).
2. Cài đặt, cấp quyền gửi SMS khi được hỏi (SEND_SMS).

## Bước 2 — Bật "Cloud Server" mode + lấy username/password

1. Mở app, chọn chế độ **"Cloud Server"** (không phải "Local Server") —
   chế độ này cho phép server web (dù chạy ở đâu, kể cả khi deploy công
   khai) gọi được tới điện thoại mà KHÔNG cần cùng mạng Wi-Fi/IP tĩnh.
2. Bấm kết nối — app tự sinh ra 1 cặp **username** + **password** (không
   cần đăng ký email/tài khoản gì cả), hiển thị ngay trong app.
3. Copy 2 giá trị đó vào `.env.local`:
   ```
   SMS_GATEWAY_USERNAME=...
   SMS_GATEWAY_PASSWORD=...
   ```

## Bước 3 — Đảm bảo gian hàng có số điện thoại

Tính năng dùng LUÔN cột `shops.phone` đã có sẵn (điền ở trang `/seller` >
"Tài khoản người bán" > "Sửa thông tin") — không cần thêm cấu hình gì
khác. Nếu muốn có 1 số mặc định dùng chung (phòng khi gian hàng nào đó
quên điền số điện thoại), điền thêm vào `.env.local`:
```
SMS_DEFAULT_PHONE=09xxxxxxxx
```

## Bước 4 — Chạy thử

1. `npm run dev`, đăng nhập vai trò Người mua, đặt 1 đơn hàng bất kỳ ở
   `/checkout`.
2. Điện thoại Android (đang chạy app SMS Gateway, mở nền/khoá màn hình
   đều được, chỉ cần còn bật + có sóng) sẽ **tự gửi 1 SMS thật** tới chính
   số điện thoại của gian hàng trong vài giây.
3. Nếu chưa thấy SMS, xem log ở terminal chạy `npm run dev` (mọi lỗi đều
   được ghi log với tiền tố `[sms]`/`[notify-order]`) — lỗi thường gặp:
   sai username/password, hoặc điện thoại bị tắt Wi-Fi/dữ liệu di động nên
   app mất kết nối với máy chủ trung chuyển.

## Lưu ý

- Máy chủ trung chuyển (`api.sms-gate.app`) của SMS Gateway for Android là
  **miễn phí hoàn toàn**, không giới hạn cho quy mô đồ án (chỉ cần thông
  báo nếu vượt 10.000 tin/ngày — không xảy ra ở đây).
- Điện thoại chạy app phải **luôn bật và có kết nối mạng** thì mới gửi
  được SMS khi có đơn hàng mới — hợp lý khi demo (bật máy lúc bảo vệ đồ
  án), nhưng nếu điện thoại tắt máy/hết pin thì tạm thời không gửi được
  (không ảnh hưởng gì tới việc đặt hàng, chỉ là không có SMS thông báo).
- Nội dung SMS được viết không dấu (bỏ dấu tiếng Việt) để tin nhắn ngắn
  gọn, tránh bị nhà mạng chia thành nhiều SMS (tốn cước hơn) — xem
  `buildMessage()` trong `src/app/api/notify-order/route.js` nếu muốn đổi
  cách trình bày.
