"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { resizeImageFile, cropImageToFile } from "@/lib/shops";
import { BANNER_ASPECT } from "@/lib/banners";

// react-easy-crop cần DOM (canvas/Image) ngay khi render — tải kiểu "dynamic"
// (chỉ chạy ở trình duyệt, ssr:false), giống cách đang dùng ở
// CapturePhotoButton.js (trang đăng sản phẩm).
const Cropper = dynamic(() => import("react-easy-crop"), { ssr: false });

/**
 * Ô chọn ảnh banner quảng cáo — khác với ảnh sản phẩm (tỉ lệ tự do), ảnh
 * banner luôn được GỢI Ý CẮT theo đúng khung ngang (BANNER_ASPECT = 3:1) vì
 * hầu hết ảnh người bán có sẵn không có sẵn tỉ lệ này, cắt sai tỉ lệ sẽ bị
 * biến dạng/hụt nội dung khi banner hiển thị trên các trang. Ảnh cũng được
 * TỰ ĐỘNG thu nhỏ (resizeImageFile, giống ảnh sản phẩm) trước khi tải lên.
 *
 * @param {{disabled?: boolean, onSelected: (file: File) => void}} props
 */
export default function BannerImageUploader({ disabled, onSelected }) {
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [pendingUrl, setPendingUrl] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropping, setCropping] = useState(false);

  function resetPending() {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingUrl("");
    setPendingFile(null);
    setCropMode(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại cùng 1 file lần sau
    if (!file) return;

    setError("");
    setPreparing(true);
    try {
      const resized = await resizeImageFile(file);
      setPendingFile(resized);
      setPendingUrl(URL.createObjectURL(resized));
    } catch {
      setError("Không đọc được ảnh, vui lòng thử ảnh khác.");
    } finally {
      setPreparing(false);
    }
  }

  function handleKeepOriginal() {
    if (!pendingFile) return;
    const file = pendingFile;
    resetPending();
    onSelected(file);
  }

  function handleStartCrop() {
    setCropMode(true);
  }

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixelsValue) => {
    setCroppedAreaPixels(croppedAreaPixelsValue);
  }, []);

  async function handleConfirmCrop() {
    if (!croppedAreaPixels || !pendingUrl) return;
    setCropping(true);
    try {
      const file = await cropImageToFile(pendingUrl, croppedAreaPixels);
      resetPending();
      onSelected(file);
    } catch {
      setError("Cắt ảnh thất bại, vui lòng thử lại.");
    } finally {
      setCropping(false);
    }
  }

  function handleCancel() {
    resetPending();
  }

  return (
    <div>
      {!pendingUrl && (
        <label
          className={`inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md font-medium transition-colors ${
            disabled || preparing
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-gray-900 text-white hover:bg-gray-800 cursor-pointer"
          }`}
        >
          {preparing ? "Đang xử lý ảnh..." : "🖼️ Chọn ảnh banner"}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={disabled || preparing}
            className="hidden"
          />
        </label>
      )}

      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}

      {pendingUrl && !cropMode && (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh vừa chọn, xem trước tạm thời */}
          <img
            src={pendingUrl}
            alt="Ảnh banner vừa chọn"
            className="w-full max-w-md rounded-lg border border-gray-200"
            style={{ aspectRatio: "3 / 1", objectFit: "cover" }}
          />
          <p className="text-xs text-gray-500 mt-2">
            Banner hiển thị theo khung ngang (tỉ lệ 3:1) — nên cắt lại cho vừa khung để không bị
            hụt nội dung quan trọng của ảnh.
          </p>
          <div className="flex gap-3 mt-3">
            <button
              type="button"
              onClick={handleStartCrop}
              className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              ✂️ Cắt cho vừa khung
            </button>
            <button
              type="button"
              onClick={handleKeepOriginal}
              className="border border-gray-900 text-gray-900 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Giữ nguyên
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {pendingUrl && cropMode && (
        <div>
          <div
            className="relative w-full max-w-md bg-gray-900 rounded-lg overflow-hidden"
            style={{ height: 220 }}
          >
            <Cropper
              image={pendingUrl}
              crop={crop}
              zoom={zoom}
              aspect={BANNER_ASPECT}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full max-w-md block mt-3"
            aria-label="Phóng to/thu nhỏ ảnh khi cắt"
          />
          <div className="flex gap-3 mt-3">
            <button
              type="button"
              onClick={handleConfirmCrop}
              disabled={cropping || !croppedAreaPixels}
              className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {cropping ? "Đang cắt..." : "Xong"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={cropping}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:border-gray-900 hover:text-gray-900 transition-colors disabled:opacity-50"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
