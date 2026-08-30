"use client";

import { useEffect, useRef, useState } from "react";
import ProductCard from "../../components/ProductCard";

// 9MB (đúng bằng giới hạn phía server /api/search-image) — chặn sớm ở
// trình duyệt để khỏi mất công gửi lên rồi mới bị từ chối.
const MAX_FILE_BYTES = 6.5 * 1024 * 1024;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || "";
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageSearchClient() {
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [description, setDescription] = useState("");
  const [results, setResults] = useState(null);

  // Camera trực tiếp trong trang (KHÁC với input file "capture" trước đây
  // — cái đó chỉ mở app camera riêng của hệ điều hành rồi trả về file, còn
  // đây mở luôn khung hình camera NGAY TRONG trang web, có nút "Chụp"
  // riêng, giống hệt cách trang quét mã vạch (/search/barcode) đang làm).
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const uploadInputRef = useRef(null);

  // Dọn dẹp: tắt camera nếu người dùng rời trang trong lúc camera đang mở
  // — nếu không trình duyệt vẫn giữ đèn camera sáng dù đã rời trang.
  useEffect(() => {
    return () => stopCameraStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy dọn dẹp 1 lần lúc unmount
  }, []);

  function stopCameraStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    setError("");
    setCameraError("");
    setDescription("");
    setResults(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // Gán stream vào thẻ <video> ngay sau khi nó được render (xem effect
      // bên dưới) — không gán trực tiếp ở đây vì videoRef.current lúc này
      // vẫn còn null (thẻ <video> chỉ render khi cameraOpen = true).
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

  // Gán stream vào <video> ngay khi thẻ video xuất hiện trong DOM.
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

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
          setError("Không chụp được ảnh, vui lòng thử lại.");
          return;
        }
        setPreviewUrl(URL.createObjectURL(blob));
        submitImage(blob);
      },
      "image/jpeg",
      0.9
    );
  }

  function handleUploadChange(e) {
    const file = e.target.files?.[0];
    // Cho phép chọn lại đúng tệp cũ ở lần sau vẫn kích hoạt onChange.
    e.target.value = "";
    if (!file) return;
    validateAndUse(file);
  }

  function validateAndUse(file) {
    setError("");
    setDescription("");
    setResults(null);

    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn 1 tệp hình ảnh.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Ảnh quá lớn, vui lòng chọn ảnh nhỏ hơn 6MB.");
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    submitImage(file);
  }

  async function submitImage(fileOrBlob) {
    setLoading(true);
    setError("");
    setResults(null);

    try {
      const mimeType = fileOrBlob.type || "image/jpeg";
      const base64Image = await fileToBase64(fileOrBlob);
      const res = await fetch("/api/search-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image, mimeType }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Có lỗi xảy ra, vui lòng thử lại.");
        return;
      }

      setDescription(data.imageDescription || "");
      setResults(data.matches || []);
    } catch {
      setError("Không thể kết nối tới máy chủ. Kiểm tra mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  }

  function triggerUploadPicker() {
    uploadInputRef.current?.click();
  }

  return (
    <main className="flex-1 bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <span className="text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
          📷 Tìm kiếm bằng hình ảnh
        </span>
        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">
          Tải lên ảnh bánh bạn thích
        </h1>
        <p className="text-gray-600 mb-8">
          Tải lên ảnh có sẵn, hoặc mở camera chụp ảnh mới ngay tại chỗ — AI sẽ nhìn và gợi ý
          sản phẩm tương tự trong cửa hàng.
        </p>

        {/* Trình chọn tệp/thư viện ảnh bình thường — dùng khi ảnh đã có sẵn
            trên thiết bị. */}
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          onChange={handleUploadChange}
          className="hidden"
        />

        {!cameraOpen && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <button
              type="button"
              onClick={triggerUploadPicker}
              disabled={loading}
              className="bg-gray-900 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Đang phân tích ảnh..." : "🖼️ Tải ảnh có sẵn"}
            </button>
            <button
              type="button"
              onClick={openCamera}
              disabled={loading}
              className="border border-gray-900 text-gray-900 px-6 py-3 rounded-md font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              📷 Chụp ảnh mới
            </button>
          </div>
        )}

        {cameraError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-6 text-left">
            {cameraError}
          </div>
        )}

        {/* Khung camera trực tiếp — chỉ hiện khi đã mở camera thành công. */}
        {cameraOpen && (
          <div className="mb-6">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- video xem trước từ camera, không có phụ đề */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-w-sm mx-auto rounded-lg border border-gray-200 bg-black"
            />
            <div className="flex gap-3 justify-center mt-4">
              <button
                type="button"
                onClick={capturePhoto}
                className="bg-gray-900 text-white px-6 py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors"
              >
                📸 Chụp ảnh
              </button>
              <button
                type="button"
                onClick={closeCamera}
                className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-md font-medium hover:border-gray-900 hover:text-gray-900 transition-colors"
              >
                Huỷ
              </button>
            </div>
          </div>
        )}

        {previewUrl && !cameraOpen && (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước từ file/ảnh vừa chụp, không phải asset tĩnh
          <img
            src={previewUrl}
            alt="Ảnh bạn đã chọn"
            className="w-full max-w-xs mx-auto rounded-lg border border-gray-200 mb-6"
          />
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-8 text-left">
            {error}
          </div>
        )}

        {description && (
          <div className="bg-gray-50 border border-gray-200 rounded-md px-4 py-3 mb-8 text-left text-sm text-gray-700">
            <span className="font-medium text-gray-900">AI nhìn thấy: </span>
            {description}
          </div>
        )}

        {results && results.length === 0 && !loading && (
          <p className="text-center text-gray-500">
            Không tìm thấy sản phẩm tương tự. Hãy thử ảnh khác hoặc dùng tìm kiếm bằng văn bản.
          </p>
        )}
      </div>

      {results && results.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.map(({ product, reason }) => (
              <ProductCard key={product.id} product={product} reason={reason} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
