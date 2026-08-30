"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { cropImageToFile } from "@/lib/shops";

// react-easy-crop cần DOM (canvas/Image) ngay khi render — tải kiểu "dynamic"
// (chỉ chạy ở trình duyệt, ssr:false) để tránh lỗi khi Next.js render trước
// ở phía server, giống cách html5-qrcode đang được tải ở trang quét mã vạch.
const Cropper = dynamic(() => import("react-easy-crop"), { ssr: false });

/**
 * Nút "Chụp ảnh mới" — mở camera NGAY TRONG trang (giống /search/image),
 * sau khi chụp cho phép người bán chọn GIỮ NGUYÊN hoặc CẮT BỚT phần thừa
 * (dùng react-easy-crop) trước khi đưa ảnh vào danh sách ảnh sản phẩm.
 *
 * @param {{disabled?: boolean, onCaptured: (file: File) => void}} props
 */
export default function CapturePhotoButton({ disabled, onCaptured }) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState("");
  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropping, setCropping] = useState(false);

  useEffect(() => {
    return () => stopCameraStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy dọn dẹp 1 lần lúc unmount
  }, []);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  function stopCameraStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCameraError(
          "Trình duyệt/thiết bị chưa cấp quyền dùng camera. Hãy cho phép truy cập camera rồi thử lại."
        );
      } else if (name === "NotFoundError") {
        setCameraError("Không tìm thấy camera trên thiết bị này.");
      } else if (name === "NotReadableError") {
        setCameraError(
          "Camera đang được ứng dụng khác sử dụng, vui lòng đóng ứng dụng đó rồi thử lại."
        );
      } else {
        setCameraError("Không thể mở camera, vui lòng thử lại hoặc dùng cách tải ảnh có sẵn.");
      }
      setCameraOpen(false);
    }
  }

  function closeCamera() {
    stopCameraStream();
    setCameraOpen(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    closeCamera();

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Không chụp được ảnh, vui lòng thử lại.");
          return;
        }
        setCapturedBlob(blob);
        setCapturedUrl(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.92
    );
  }

  function resetCapture() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl("");
    setCropMode(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  function handleKeepOriginal() {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
    resetCapture();
    onCaptured(file);
  }

  function handleStartCrop() {
    setCropMode(true);
  }

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixelsValue) => {
    setCroppedAreaPixels(croppedAreaPixelsValue);
  }, []);

  async function handleConfirmCrop() {
    if (!croppedAreaPixels || !capturedUrl) return;
    setCropping(true);
    try {
      const file = await cropImageToFile(capturedUrl, croppedAreaPixels);
      resetCapture();
      onCaptured(file);
    } catch {
      setCameraError("Cắt ảnh thất bại, vui lòng thử lại.");
    } finally {
      setCropping(false);
    }
  }

  function handleCancelCapture() {
    resetCapture();
  }

  return (
    <>
      {!cameraOpen && !capturedUrl && (
        <button
          type="button"
          onClick={openCamera}
          disabled={disabled}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md border border-gray-900 text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          📷 Chụp ảnh mới
        </button>
      )}

      {cameraError && <p className="text-xs text-red-600 mt-1.5">{cameraError}</p>}

      {cameraOpen && (
        <div className="mb-4">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- video xem trước từ camera, không có phụ đề */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-w-sm mx-auto rounded-lg border border-gray-200 bg-black"
          />
          <div className="flex gap-3 justify-center mt-3">
            <button
              type="button"
              onClick={capturePhoto}
              className="bg-gray-900 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              📸 Chụp ảnh
            </button>
            <button
              type="button"
              onClick={closeCamera}
              className="border border-gray-300 text-gray-700 px-5 py-2 rounded-md text-sm font-medium hover:border-gray-900 hover:text-gray-900 transition-colors"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {capturedUrl && !cropMode && (
        <div className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh vừa chụp bằng camera, xem trước tạm thời */}
          <img
            src={capturedUrl}
            alt="Ảnh vừa chụp"
            className="w-full max-w-xs mx-auto rounded-lg border border-gray-200"
          />
          <p className="text-xs text-gray-500 text-center mt-2">
            Ảnh có phần thừa muốn cắt bớt không?
          </p>
          <div className="flex gap-3 justify-center mt-3">
            <button
              type="button"
              onClick={handleKeepOriginal}
              className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Giữ nguyên
            </button>
            <button
              type="button"
              onClick={handleStartCrop}
              className="border border-gray-900 text-gray-900 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              ✂️ Cắt ảnh
            </button>
            <button
              type="button"
              onClick={handleCancelCapture}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {capturedUrl && cropMode && (
        <div className="mb-4">
          <div className="relative w-full max-w-sm mx-auto bg-gray-900 rounded-lg overflow-hidden" style={{ height: 320 }}>
            <Cropper
              image={capturedUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
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
            className="w-full max-w-sm mx-auto block mt-3"
            aria-label="Phóng to/thu nhỏ ảnh khi cắt"
          />
          <div className="flex gap-3 justify-center mt-3">
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
              onClick={handleCancelCapture}
              disabled={cropping}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:border-gray-900 hover:text-gray-900 transition-colors disabled:opacity-50"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </>
  );
}
