"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useShop } from "../../providers";
import { findProductByCode } from "./CodeSearchClient";

// Quét mã vạch/QR bằng camera — dùng thư viện MIỄN PHÍ, mã nguồn mở
// "html5-qrcode" (chạy hoàn toàn trên trình duyệt, không gọi API/AI nào,
// không tốn quota Gemini). Thư viện hỗ trợ sẵn QR, EAN-13/8, UPC-A/E,
// Code-39/93/128, ITF, Aztec, Data Matrix, PDF-417 — không cần cấu hình
// thêm. Sau khi quét ra 1 chuỗi mã, dùng LẠI đúng hàm findProductByCode()
// đã viết ở CodeSearchClient.js (tính năng tìm theo mã số) để tra cứu sản
// phẩm — vẫn tra cứu bằng dữ liệu thật, không qua AI.
//
// Dùng import() động (thay vì import tĩnh ở đầu file) vì html5-qrcode chỉ
// chạy được trên trình duyệt (cần camera/DOM) — nếu import tĩnh, bước
// build/SSR của Next.js có thể lỗi vì cố chạy thư viện này trên server.
const SCANNER_ELEMENT_ID = "shopai-barcode-scanner";

export default function BarcodeScannerClient() {
  const router = useRouter();
  const { allProducts, hydrated } = useShop();
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [notFoundCode, setNotFoundCode] = useState("");
  const scannerRef = useRef(null);

  useEffect(() => {
    // Dọn dẹp: nếu người dùng rời trang trong lúc camera đang bật, phải tắt
    // camera đi — nếu không trình duyệt vẫn giữ đèn camera sáng dù đã rời
    // trang.
    return () => {
      scannerRef.current?.stop().catch(() => {}).finally(() => {
        scannerRef.current?.clear().catch(() => {});
      });
    };
  }, []);

  async function handleScanSuccess(decodedText) {
    // Dừng camera ngay khi quét được 1 mã — tránh quét trùng liên tục.
    await stopScanning();

    const found = findProductByCode(allProducts, decodedText);
    if (found) {
      router.push(`/san-pham/${found.id}`);
    } else {
      setNotFoundCode(decodedText);
    }
  }

  async function startScanning() {
    setCameraError("");
    setNotFoundCode("");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanSuccess(decodedText);
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
        setCameraError(
          "Trình duyệt/thiết bị chưa cấp quyền dùng camera. Hãy cho phép truy cập camera rồi thử lại."
        );
      } else if (name === "NotFoundError") {
        setCameraError("Không tìm thấy camera trên thiết bị này.");
      } else if (name === "NotReadableError") {
        setCameraError("Camera đang được ứng dụng khác sử dụng, vui lòng đóng ứng dụng đó rồi thử lại.");
      } else {
        setCameraError("Không thể mở camera, vui lòng thử lại.");
      }
      setScanning(false);
    }
  }

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

  return (
    <div className="max-w-md mx-auto text-left">
      <button
        type="button"
        onClick={scanning ? stopScanning : startScanning}
        disabled={!hydrated}
        className={`w-full rounded-md py-2.5 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          scanning
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-gray-900 text-white hover:bg-gray-800"
        }`}
      >
        {scanning ? "⏹ Dừng quét" : "📷 Bắt đầu quét bằng camera"}
      </button>

      {cameraError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mt-4">
          {cameraError}
        </div>
      )}

      {notFoundCode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-md px-4 py-3 mt-4">
          Đã quét được mã &quot;{notFoundCode}&quot; nhưng không khớp sản phẩm nào trong hệ
          thống. Đây là bản demo đồ án nên sản phẩm chưa có mã vạch thật — bạn có thể tự tạo mã
          QR chứa đúng mã sản phẩm (vd &quot;bsn-1&quot;) bằng công cụ tạo QR miễn phí để test.
        </div>
      )}

      {/* Vùng hiển thị hình ảnh camera + khung quét — html5-qrcode tự vẽ
          giao diện video vào bên trong div này. */}
      <div id={SCANNER_ELEMENT_ID} className="mt-4 rounded-md overflow-hidden" />
    </div>
  );
}
