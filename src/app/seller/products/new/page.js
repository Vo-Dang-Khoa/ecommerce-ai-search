"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth, useShop } from "../../../providers";
import { CATEGORIES } from "@/lib/products";
import {
  uploadProductImage,
  resizeImageFile,
  uploadProductVideo,
  validateProductVideo,
  VIDEO_MAX_SECONDS,
  VIDEO_MAX_BYTES,
} from "@/lib/shops";
import { moderateProductContent } from "@/lib/security";

export default function NewProductPage() {
  const router = useRouter();
  const { user, hydrated: authHydrated } = useAuth();
  const { myShop, addProduct } = useShop();

  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [images, setImages] = useState([]);
  const [imageUrl, setImageUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!authHydrated) return null;
  if (!user || !myShop) {
    return (
      <main className="flex-1 bg-amber-50">
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <p className="text-gray-600 mb-6">
            Bạn cần đăng ký gian hàng trước khi thêm sản phẩm.
          </p>
          <Link
            href="/seller"
            className="bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
          >
            Đến trang gian hàng
          </Link>
        </div>
      </main>
    );
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    setError("");
    setUploading(true);
    try {
      // Upload tuần tự để giữ đúng thứ tự ảnh người dùng chọn. Ảnh vượt quá
      // kích thước/dung lượng khuyến nghị sẽ được TỰ ĐỘNG thu nhỏ trước khi
      // tải lên (resizeImageFile) — không còn từ chối thẳng như trước.
      const urls = [];
      for (const file of files) {
        const resized = await resizeImageFile(file);
        const url = await uploadProductImage(resized, myShop.id);
        urls.push(url);
      }
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      setError(err.message || "Tải ảnh lên Supabase thất bại.");
    } finally {
      setUploading(false);
    }
  }

  async function handleVideoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setVideoError("");
    if (!file.type.startsWith("video/")) {
      setVideoError("Vui lòng chọn 1 tệp video.");
      return;
    }

    setVideoUploading(true);
    try {
      // Kiểm tra thời lượng/dung lượng TRƯỚC khi tải lên — nếu vượt giới
      // hạn, báo lỗi kèm hướng dẫn cụ thể để người bán tự cắt/nén, không
      // tự động tải video quá khổ lên Supabase.
      const validationError = await validateProductVideo(file);
      if (validationError) {
        setVideoError(validationError);
        return;
      }

      const url = await uploadProductVideo(file, myShop.id);
      setVideoUrl(url);
    } catch (err) {
      setVideoError(err.message || "Tải video lên Supabase thất bại.");
    } finally {
      setVideoUploading(false);
    }
  }

  function handleRemoveVideo() {
    setVideoUrl("");
    setVideoError("");
  }

  function handleAddImageUrl() {
    // Nút này CHỈ thêm ảnh từ URL dán sẵn, KHÔNG tải file lên — nếu ô URL
    // đang trống thì báo rõ lý do, tránh trường hợp bấm mà "không có tác
    // dụng gì" như trước (trước đây chỉ return() im lặng, không báo lỗi).
    if (!imageUrl.trim()) {
      setUrlError("Vui lòng dán URL ảnh vào ô bên cạnh trước khi bấm \"Thêm URL ảnh\".");
      return;
    }
    setUrlError("");
    setImages((prev) => [...prev, imageUrl.trim()]);
    setImageUrl("");
  }

  function handleRemoveImage(index) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (name.trim().length < 3) {
      setError("Tên sản phẩm phải có ít nhất 3 ký tự.");
      return;
    }
    const priceValue = Number(price);
    if (!priceValue || priceValue <= 0) {
      setError("Giá sản phẩm phải lớn hơn 0.");
      return;
    }
    setError("");
    setSubmitting(true);

    // Kiểm duyệt nội dung bằng AI TRƯỚC khi đăng bán công khai — chặn sản
    // phẩm vi phạm (hàng cấm, dấu hiệu lừa đảo, spam...). Nếu dịch vụ AI
    // lỗi/chưa cấu hình GEMINI_API_KEY, moderateProductContent() tự FAIL
    // OPEN (không chặn), để tính năng đăng sản phẩm cốt lõi không phụ
    // thuộc vào việc AI có sẵn sàng hay không — xem src/lib/security.js.
    const moderation = await moderateProductContent({
      name: name.trim(),
      category,
      desc: desc.trim(),
    });
    if (!moderation.allowed) {
      setError(
        `Sản phẩm không được phép đăng bán: ${
          moderation.reason || "vi phạm quy định của ShopAI"
        }.`
      );
      setSubmitting(false);
      return;
    }

    try {
      const product = await addProduct({
        name: name.trim(),
        category,
        price: priceValue,
        desc: desc.trim(),
        images,
        videoUrl: videoUrl || null,
      });
      router.push(`/seller/products/${product.id}`);
    } catch (err) {
      setError(err.message || "Tạo sản phẩm thất bại, vui lòng thử lại.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Thêm sản phẩm mới</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Tên sản phẩm</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Bánh quy Oreo, Áo nam, ..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Danh mục</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Giá (đ)</label>
            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="48500"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Mô tả</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="Mô tả ngắn gọn về sản phẩm..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Hình ảnh sản phẩm</label>

            {images.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- ảnh từ Supabase Storage/URL ngoài, không tối ưu bằng next/image */}
                    <img
                      src={img}
                      alt={`Ảnh ${i + 1}`}
                      className="w-20 h-20 object-cover rounded-md border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(i)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-5"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Nút chọn ảnh TỪ MÁY để tải lên Supabase Storage — đây mới là
                nút thực sự "tải ảnh lên". Bọc <input type="file"> (ẩn) bên
                trong <label> để có nút bấm rõ ràng thay vì input file mặc
                định của trình duyệt (nhỏ, dễ bị bỏ qua). */}
            <label
              className={`inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md transition-colors ${
                uploading
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gray-900 text-white hover:bg-gray-800 cursor-pointer"
              }`}
            >
              {uploading ? "Đang tải ảnh lên..." : "Tải ảnh lên"}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFiles}
                disabled={uploading}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-400 mt-1.5 mb-3">
              Chọn 1 hoặc nhiều ảnh từ máy — ảnh sẽ tự động tải lên. Ảnh quá lớn (trên 1600px
              hoặc trên 1.5MB) sẽ được tự động thu nhỏ vừa đủ để hiển thị rõ nét trên trang bán
              hàng, không cần bạn tự chỉnh sửa trước.
            </p>

            {/* Cách khác: dán sẵn URL ảnh có trên mạng thay vì tải file —
                KHÔNG tải file lên, chỉ thêm thẳng URL đã dán vào danh sách
                ảnh. Đặt tên nút rõ ràng để không nhầm với nút tải ảnh ở
                trên. */}
            <div className="flex gap-2">
              <input
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  if (urlError) setUrlError("");
                }}
                placeholder="Hoặc dán URL ảnh có sẵn..."
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="text-sm border border-gray-300 rounded-md px-3 py-2 hover:border-gray-900 shrink-0"
              >
                Thêm URL ảnh
              </button>
            </div>
            {urlError && <p className="text-xs text-red-600 mt-1.5">{urlError}</p>}
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">
              Video giới thiệu sản phẩm <span className="text-gray-400">(không bắt buộc)</span>
            </label>

            {videoUrl && (
              <div className="mb-3">
                <video
                  src={videoUrl}
                  controls
                  className="w-full max-w-xs rounded-md border border-gray-200"
                />
                <button
                  type="button"
                  onClick={handleRemoveVideo}
                  className="block mt-1.5 text-xs text-red-600 hover:underline"
                >
                  ✕ Xoá video
                </button>
              </div>
            )}

            {!videoUrl && (
              <>
                {/* Nút chọn video TỪ MÁY để tải lên Supabase Storage (bucket
                    "product-videos") — kiểm tra thời lượng/dung lượng ở
                    trình duyệt TRƯỚC khi tải lên (validateProductVideo),
                    báo lỗi kèm hướng dẫn cụ thể nếu vượt giới hạn thay vì
                    tự động nén (xem ghi chú trong src/lib/shops.js). */}
                <label
                  className={`inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md transition-colors ${
                    videoUploading
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-gray-900 text-white hover:bg-gray-800 cursor-pointer"
                  }`}
                >
                  {videoUploading ? "Đang tải video lên..." : "Tải video lên"}
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoChange}
                    disabled={videoUploading}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-400 mt-1.5">
                  Chọn 1 video ngắn giới thiệu sản phẩm (tối đa {VIDEO_MAX_SECONDS} giây, tối đa{" "}
                  {VIDEO_MAX_BYTES / (1024 * 1024)}MB). Nếu video dài hoặc nặng hơn giới hạn, hệ
                  thống sẽ báo lỗi kèm hướng dẫn cắt/nén video, không tự động tải lên.
                </p>
              </>
            )}
            {videoError && <p className="text-xs text-red-600 mt-1.5">{videoError}</p>}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || uploading}
            className="bg-gray-900 text-white py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Đang kiểm duyệt & tạo sản phẩm..." : "Tạo sản phẩm"}
          </button>
        </form>
      </div>
    </main>
  );
}
