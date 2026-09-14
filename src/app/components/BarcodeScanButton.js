"use client";

import { useEffect, useRef, useState } from "react";

// v17: nút "Quét mã vạch/QR bằng camera" DÙNG CHUNG — tách ra từ
// BarcodeScannerClient.js (trang /search/barcode, dành cho NGƯỜI MUA) để
// dùng lại y hệt cho trang NGƯỜI BÁN đăng/sửa sản phẩm (nhập mã vạch thật in
// trên bao bì). Vẫn dùng thư viện MIỄN PHÍ, mã nguồn mở "html5-qrcode" (chạy
// hoàn toàn trên trình duyệt, không gọi API/AI nào) — hỗ trợ sẵn QR, EAN-13/
// 8, UPC-A/E, Code-39/93/128, ITF, Aztec, Data Matrix, PDF-417.
//
// Khác với BarcodeScannerClient.js (tự tra cứu sản phẩm rồi điều hướng),
// component này CHỈ quét và trả chuỗi mã về qua onScan(code) — nơi gọi (form
// đăng/sửa sản phẩm) tự quyết định làm gì với chuỗi đó (điền vào ô input).
//
// Dùng import() động (thay vì import tĩnh ở đầu file) vì html5-qrcode chỉ
// chạy được trên trình duyệt (cần camera/DOM) — nếu import tĩnh, bước
// build/SSR của Next.js có thể lỗi vì cố chạy thư viện này trên server.
export default function BarcodeScanButton({ onScan, elementId }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const scannerRef = useRef(null);
  // Mỗi lần dùng component này ở nhiều nơi trên cùng 1 trang (hiếm khi xảy
  // ra, nhưng vẫn có thể) cần id DOM khác nhau — tự sinh 1 id ổn định nếu nơi
  // gọi không truyền elementId riêng.
  const idRef = useRef(elementId || `shopai-barcode-scan-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    // Dọn dẹp: nếu người dùng rời trang/đóng form trong lúc camera đang bật,
    // phải tắt camera đi — nếu không trình duyệt vẫn giữ đèn camera sáng dù
    // đã rời trang.
    return () => {
      scannerRef.current?.stop().catch(() => {}).finally(() => {
        scannerRef.current?.clear().catch(() => {});
      });
    };
  }, []);

  async function stopScanning() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // Có thể đã dừng sẵn — bỏ qua.
      }
    }
    setScanning(false);
  }

  async function startScanning() {
    setError("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(idRef.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          // Dừng camera ngay khi quét được 1 mã — tránh quét trùng liên tục.
          await stopScanning();
          onScan(decodedText);
        },
        () => {
          // Callback báo "chưa quét được ở khung hình này" — gọi liên tục
          // trong lúc quét, KHÔNG phải lỗi thật, nên cố tình bỏ qua.
        }
      );

      setScanning(true);
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(
          "Trình duyệt/thiết bị chưa cấp quyền dùng camera. Hãy cho phép truy cập camera rồi thử lại."
        );
      } else if (name === "NotFoundError") {
        setError("Không tìm thấy camera trên thiết bị này.");
      } else if (name === "NotReadableError") {
        setError("Camera đang được ứng dụng khác sử dụng, vui lòng đóng ứng dụng đó rồi thử lại.");
      } else {
        setError("Không thể mở camera, vui lòng thử lại.");
      }
      setScanning(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={scanning ? stopScanning : startScanning}
        className={`inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md font-medium transition-colors ${
          scanning
            ? "bg-red-600 text-white hover:bg-red-700"
            : "border border-gray-300 text-gray-700 hover:border-gray-900 hover:text-gray-900"
        }`}
      >
        {scanning ? "⏹ Dừng quét" : "📷 Quét mã vạch/QR bằng camera"}
      </button>

      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}

      {/* Vùng hiển thị hình ảnh camera + khung quét — html5-qrcode tự vẽ
          giao diện video vào bên trong div này. Chỉ chiếm chỗ khi đang quét. */}
      {scanning && <div id={idRef.current} className="mt-3 rounded-md overflow-hidden max-w-xs" />}
    </div>
  );
}
