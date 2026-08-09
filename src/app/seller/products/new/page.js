"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth, useShop } from "../../../providers";
import { CATEGORIES } from "@/lib/products";
import { uploadProductImage } from "@/lib/shops";

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

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
  const [uploading, setUploading] = useState(false);
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
    const oversized = files.find((f) => f.size > MAX_IMAGE_BYTES);
    if (oversized) {
      setError(`Ảnh "${oversized.name}" vượt quá 1.5MB, vui lòng chọn ảnh nhỏ hơn.`);
      return;
    }
    setError("");
    setUploading(true);
    try {
      // Upload tuần tự để giữ đúng thứ tự ảnh người dùng chọn
      const urls = [];
      for (const file of files) {
        const url = await uploadProductImage(file, myShop.id);
        urls.push(url);
      }
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      setError(err.message || "Tải ảnh lên Supabase thất bại.");
    } finally {
      setUploading(false);
    }
  }

  function handleAddImageUrl() {
    if (!imageUrl.trim()) return;
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
    try {
      const product = await addProduct({
        name: name.trim(),
        category,
        price: priceValue,
        desc: desc.trim(),
        images,
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
              placeholder="Bánh quy Oreo"
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

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              disabled={uploading}
              className="text-sm mb-2"
            />
            {uploading && (
              <p className="text-xs text-gray-500 mb-2">Đang tải ảnh lên Supabase...</p>
            )}

            <div className="flex gap-2">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Hoặc dán URL ảnh..."
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="text-sm border border-gray-300 rounded-md px-3 py-2 hover:border-gray-900"
              >
                Thêm ảnh
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || uploading}
            className="bg-gray-900 text-white py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Đang tạo..." : "Tạo sản phẩm"}
          </button>
        </form>
      </div>
    </main>
  );
}
