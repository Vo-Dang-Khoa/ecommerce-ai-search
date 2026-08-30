"use client";

import { useRef, useState } from "react";
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
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

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

  async function submitImage(file) {
    setLoading(true);
    setError("");
    setResults(null);

    try {
      const base64Image = await fileToBase64(file);
      const res = await fetch("/api/search-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image, mimeType: file.type }),
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

  function triggerFilePicker() {
    fileInputRef.current?.click();
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
          Chọn 1 tấm ảnh (hoặc chụp trực tiếp trên điện thoại), AI sẽ nhìn và gợi ý sản phẩm
          tương tự trong cửa hàng.
        </p>

        {/* capture="environment" gợi ý mở camera sau trên điện thoại — trên
            máy tính vẫn hoạt động bình thường như input chọn file. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={triggerFilePicker}
          disabled={loading}
          className="bg-gray-900 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 mb-6"
        >
          {loading ? "Đang phân tích ảnh..." : "📷 Chọn hoặc chụp ảnh"}
        </button>

        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước từ file khách vừa chọn, không phải asset tĩnh
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
