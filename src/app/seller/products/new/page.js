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
  readVideoDuration,
  VIDEO_MAX_SECONDS,
  VIDEO_MAX_BYTES,
} from "@/lib/shops";
import { isVideoReencodeSupported, reencodeVideoSegment, autoCompressVideo } from "@/lib/videoProcessing";
import { moderateProductContent } from "@/lib/security";
import CapturePhotoButton from "./CapturePhotoButton";
import RecordVideoButton from "./RecordVideoButton";
import VideoTrimModal from "./VideoTrimModal";

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
  // Video quá {VIDEO_MAX_SECONDS} giây -> mở khung cắt (VideoTrimModal) chờ
  // người bán chọn đoạn cần giữ, thay vì từ chối thẳng như trước (v12).
  const [pendingTrim, setPendingTrim] = useState(null); // { url, duration } | null
  const [trimProcessing, setTrimProcessing] = useState(false);
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

  // Dùng chung cho cả 2 nguồn ảnh (chọn từ máy và chụp/cắt bằng camera):
  // thu nhỏ nếu cần rồi tải lên Supabase Storage.
  async function uploadOneImage(file) {
    const resized = await resizeImageFile(file);
    return uploadProductImage(resized, myShop.id);
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    setError("");
    setUploading(true);
    try {
      // Upload tuần tự để giữ đúng thứ tự ảnh người dùng chọn.
      const urls = [];
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop -- cần tải tuần tự để giữ đúng thứ tự ảnh
        const url = await uploadOneImage(file);
        urls.push(url);
      }
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      setError(err.message || "Tải ảnh lên Supabase thất bại.");
    } finally {
      setUploading(false);
    }
  }

  // Ảnh vừa chụp bằng camera (giữ nguyên hoặc đã cắt) — xem CapturePhotoButton.
  async function handleCapturedImage(file) {
    setError("");
    setUploading(true);
    try {
      const url = await uploadOneImage(file);
      setImages((prev) => [...prev, url]);
    } catch (err) {
      setError(err.message || "Tải ảnh lên Supabase thất bại.");
    } finally {
      setUploading(false);
    }
  }

  function videoErrorMessage(err, fallback) {
    if (err?.message === "UNSUPPORTED") {
      return (
        "Trình duyệt này chưa hỗ trợ tự động cắt/nén video. Vui lòng dùng ứng dụng cắt/nén " +
        "video có sẵn trên điện thoại hoặc máy tính rồi tải lại."
      );
    }
    return err?.message || fallback;
  }

  // Xử lý chung cho video dù đến từ input file ("Tải Video lên") hay vừa
  // quay bằng camera ("Quay Video mới"): đọc thời lượng, nếu quá
  // {VIDEO_MAX_SECONDS} giây thì mở khung cắt (pendingTrim) chờ người bán
  // chọn đoạn giữ lại; nếu chỉ quá {VIDEO_MAX_BYTES} thì TỰ ĐỘNG nén rồi
  // tải lên luôn, không cần hỏi lại.
  async function handleIncomingVideo(file) {
    if (!file.type.startsWith("video/")) {
      setVideoError("Vui lòng chọn 1 tệp video.");
      return;
    }
    setVideoError("");
    setVideoUploading(true);
    try {
      const duration = await readVideoDuration(file);

      if (duration > VIDEO_MAX_SECONDS) {
        if (!isVideoReencodeSupported()) {
          setVideoError(
            `Video dài ${Math.round(duration)} giây, vượt quá ${VIDEO_MAX_SECONDS} giây cho phép. ` +
              `Trình duyệt này chưa hỗ trợ cắt video tự động — hãy cắt bớt video (giữ khoảng ` +
              `${VIDEO_MAX_SECONDS} giây đầu) bằng ứng dụng có sẵn trên điện thoại rồi tải lại.`
          );
          return;
        }
        setPendingTrim({ url: URL.createObjectURL(file), duration });
        return;
      }

      let workingFile = file;
      if (workingFile.size > VIDEO_MAX_BYTES) {
        if (!isVideoReencodeSupported()) {
          const sizeMb = (workingFile.size / (1024 * 1024)).toFixed(1);
          setVideoError(
            `Video nặng ${sizeMb}MB, vượt quá ${VIDEO_MAX_BYTES / (1024 * 1024)}MB cho phép. ` +
              `Trình duyệt này chưa hỗ trợ tự động giảm dung lượng — hãy nén video bằng ứng dụng ` +
              `có sẵn trên điện thoại/máy tính rồi tải lại.`
          );
          return;
        }
        const sourceUrl = URL.createObjectURL(workingFile);
        workingFile = await autoCompressVideo(sourceUrl, duration, VIDEO_MAX_BYTES);
        URL.revokeObjectURL(sourceUrl);
      }

      const url = await uploadProductVideo(workingFile, myShop.id);
      setVideoUrl(url);
    } catch (err) {
      setVideoError(videoErrorMessage(err, "Xử lý video thất bại, vui lòng thử lại."));
    } finally {
      setVideoUploading(false);
    }
  }

  function handleVideoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    handleIncomingVideo(file);
  }

  async function handleTrimConfirm(start, end) {
    if (!pendingTrim) return;
    const sourceUrl = pendingTrim.url;
    setTrimProcessing(true);
    try {
      let trimmedFile = await reencodeVideoSegment(sourceUrl, { start, end });
      if (trimmedFile.size > VIDEO_MAX_BYTES) {
        const trimmedUrl = URL.createObjectURL(trimmedFile);
        trimmedFile = await autoCompressVideo(trimmedUrl, end - start, VIDEO_MAX_BYTES);
        URL.revokeObjectURL(trimmedUrl);
      }
      URL.revokeObjectURL(sourceUrl);
      setPendingTrim(null);

      const url = await uploadProductVideo(trimmedFile, myShop.id);
      setVideoUrl(url);
    } catch (err) {
      URL.revokeObjectURL(sourceUrl);
      setPendingTrim(null);
      setVideoError(videoErrorMessage(err, "Cắt video thất bại, vui lòng thử lại."));
    } finally {
      setTrimProcessing(false);
    }
  }

  function handleTrimCancel() {
    if (pendingTrim) URL.revokeObjectURL(pendingTrim.url);
    setPendingTrim(null);
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

            {/* 2 nút: "Tải ảnh lên" cho ảnh đã có sẵn trong máy, "Chụp ảnh
                mới" mở camera ngay trong trang cho ảnh chưa chụp (kèm gợi ý
                cắt bớt phần thừa hoặc giữ nguyên sau khi chụp — xem
                CapturePhotoButton.js). Nút "Tải ảnh lên" bọc <input
                type="file"> (ẩn) bên trong <label> để có nút bấm rõ ràng
                thay vì input file mặc định của trình duyệt. */}
            <div className="flex flex-wrap gap-3 mb-1.5">
              <label
                className={`inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md transition-colors ${
                  uploading
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-gray-900 text-white hover:bg-gray-800 cursor-pointer"
                }`}
              >
                {uploading ? "Đang tải ảnh lên..." : "🖼️ Tải ảnh lên"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFiles}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              <CapturePhotoButton disabled={uploading} onCaptured={handleCapturedImage} />
            </div>
            <p className="text-xs text-gray-400 mt-1.5 mb-3">
              Chọn ảnh có sẵn trong máy, hoặc chụp ảnh mới ngay tại đây. Ảnh quá lớn (trên 1600px
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
                {/* 2 nút: "Tải Video lên" cho video đã có sẵn, "Quay Video
                    mới" mở camera quay trực tiếp (tự dừng ở
                    {VIDEO_MAX_SECONDS}s — xem RecordVideoButton.js). Cả 2
                    đường đều đi qua handleIncomingVideo(): video quá NẶNG
                    được TỰ ĐỘNG giảm dung lượng, video quá DÀI mở khung cắt
                    (VideoTrimModal) ngay tại trang — xem ghi chú trong
                    src/lib/videoProcessing.js. */}
                <div className="flex flex-wrap gap-3">
                  <label
                    className={`inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md transition-colors ${
                      videoUploading
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-gray-900 text-white hover:bg-gray-800 cursor-pointer"
                    }`}
                  >
                    {videoUploading ? "Đang xử lý video..." : "🎞️ Tải Video lên"}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoChange}
                      disabled={videoUploading}
                      className="hidden"
                    />
                  </label>
                  <RecordVideoButton
                    disabled={videoUploading}
                    maxSeconds={VIDEO_MAX_SECONDS}
                    onRecorded={handleIncomingVideo}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Video tối đa {VIDEO_MAX_SECONDS} giây, tối đa {VIDEO_MAX_BYTES / (1024 * 1024)}MB.
                  Video quá nặng sẽ được tự động giảm dung lượng; video quá dài sẽ cho bạn chọn
                  đoạn cần giữ ngay tại đây, không cần dùng ứng dụng khác.
                </p>
              </>
            )}
            {videoError && <p className="text-xs text-red-600 mt-1.5">{videoError}</p>}
          </div>

          {pendingTrim && (
            <VideoTrimModal
              sourceUrl={pendingTrim.url}
              duration={pendingTrim.duration}
              maxSeconds={VIDEO_MAX_SECONDS}
              processing={trimProcessing}
              onConfirm={handleTrimConfirm}
              onCancel={handleTrimCancel}
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || uploading || videoUploading || trimProcessing}
            className="bg-gray-900 text-white py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Đang kiểm duyệt & tạo sản phẩm..." : "Tạo sản phẩm"}
          </button>
        </form>
      </div>
    </main>
  );
}
