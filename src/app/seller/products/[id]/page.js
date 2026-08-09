"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAuth, useShop } from "../../../providers";
import { uploadProductImage, getEffectivePrice } from "@/lib/shops";

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

function ImagesSection({ product }) {
  const { myShop, addImage, removeImage, replaceImage } = useShop();
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleAddFiles(e) {
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
      for (const file of files) {
        const url = await uploadProductImage(file, myShop.id);
        await addImage(product.id, url);
      }
    } catch (err) {
      setError(err.message || "Tải ảnh lên Supabase thất bại.");
    } finally {
      setUploading(false);
    }
  }

  async function handleReplace(index, e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Ảnh vượt quá 1.5MB, vui lòng chọn ảnh nhỏ hơn.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const url = await uploadProductImage(file, myShop.id);
      await replaceImage(product.id, index, url);
    } catch (err) {
      setError(err.message || "Tải ảnh lên Supabase thất bại.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(index) {
    setError("");
    try {
      await removeImage(product.id, index);
    } catch (err) {
      setError(err.message || "Xoá ảnh thất bại.");
    }
  }

  const images = product.images || [];

  return (
    <section className="border border-gray-200 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Hình ảnh sản phẩm</h2>

      {images.length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">Chưa có hình ảnh nào.</p>
      ) : (
        <div className="flex flex-wrap gap-4 mb-4">
          {images.map((img, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh từ Supabase Storage/URL ngoài */}
              <img
                src={img}
                alt={`Ảnh ${i + 1}`}
                className="w-24 h-24 object-cover rounded-md border border-gray-200"
              />
              <div className="flex gap-2 text-xs">
                <label className="text-gray-600 hover:text-gray-900 cursor-pointer">
                  Đổi ảnh
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => handleReplace(i, e)}
                  />
                </label>
                <button
                  onClick={() => handleRemove(i)}
                  disabled={uploading}
                  className="text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="text-sm text-gray-700 block mb-1">Thêm ảnh mới</label>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleAddFiles}
        disabled={uploading}
        className="text-sm"
      />
      {uploading && (
        <p className="text-xs text-gray-500 mt-2">Đang tải ảnh lên Supabase...</p>
      )}

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </section>
  );
}

function PriceSection({ product }) {
  const { setPrice, adjustPrice } = useShop();
  const [value, setValue] = useState(String(product.price));
  const [error, setError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    try {
      await setPrice(product.id, value);
    } catch (err) {
      setError(err.message || "Cập nhật giá thất bại.");
    }
  }

  async function handleAdjust(deltaPercent) {
    setError("");
    try {
      await adjustPrice(product.id, deltaPercent);
      setValue((v) =>
        String(
          deltaPercent < 0
            ? Math.max(0, Math.round((Number(v) * 0.9) / 500) * 500)
            : Math.round((Number(v) * 1.1) / 500) * 500
        )
      );
    } catch (err) {
      setError(err.message || "Điều chỉnh giá thất bại.");
    }
  }

  return (
    <section className="border border-gray-200 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Giá bán</h2>
      <p className="text-sm text-gray-500 mb-3">
        Giá hiện tại:{" "}
        <span className="font-semibold text-gray-900">
          {product.price.toLocaleString("vi-VN")}đ
        </span>
      </p>

      <form onSubmit={handleSave} className="flex gap-2 mb-3">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        />
        <button
          type="submit"
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800"
        >
          Cập nhật giá
        </button>
      </form>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleAdjust(-10)}
          className="text-xs border border-gray-300 rounded-full px-3 py-1 hover:border-gray-900"
        >
          Điều chỉnh -10%
        </button>
        <button
          onClick={() => handleAdjust(10)}
          className="text-xs border border-gray-300 rounded-full px-3 py-1 hover:border-gray-900"
        >
          Điều chỉnh +10%
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </section>
  );
}

function PromotionSection({ product }) {
  const { setPromotion, removePromotion } = useShop();
  const [percent, setPercent] = useState(product.promotion?.percent ?? 10);
  const [label, setLabel] = useState(product.promotion?.label ?? "");
  const [error, setError] = useState("");

  async function handleCreate(e) {
    e.preventDefault();
    const p = Number(percent);
    if (!p || p <= 0 || p >= 100) {
      setError("Phần trăm giảm giá phải trong khoảng 1-99.");
      return;
    }
    setError("");
    try {
      await setPromotion(product.id, { percent: p, label: label.trim() || `Giảm ${p}%` });
    } catch (err) {
      setError(err.message || "Tạo khuyến mãi thất bại.");
    }
  }

  async function handleRemove() {
    setError("");
    try {
      await removePromotion(product.id);
    } catch (err) {
      setError(err.message || "Huỷ khuyến mãi thất bại.");
    }
  }

  return (
    <section className="border border-gray-200 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Khuyến mãi</h2>

      {product.promotion ? (
        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-1">
            Đang áp dụng:{" "}
            <span className="font-semibold text-red-600">
              -{product.promotion.percent}%
            </span>{" "}
            — {product.promotion.label}
          </p>
          <p className="text-sm text-gray-500 mb-3">
            Giá sau giảm:{" "}
            <span className="font-semibold text-gray-900">
              {getEffectivePrice(product).toLocaleString("vi-VN")}đ
            </span>{" "}
            <span className="line-through text-gray-400">
              {product.price.toLocaleString("vi-VN")}đ
            </span>
          </p>
          <button
            onClick={handleRemove}
            className="text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-md px-3 py-1.5"
          >
            Huỷ khuyến mãi
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-4">Sản phẩm chưa có khuyến mãi.</p>
      )}

      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <p className="text-sm text-gray-700">
          {product.promotion ? "Cập nhật khuyến mãi" : "Tạo khuyến mãi mới"}
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            max="99"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nhãn khuyến mãi (VD: Giảm giá khai trương)"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800"
          >
            {product.promotion ? "Cập nhật" : "Tạo khuyến mãi"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </section>
  );
}

function AttributesSection({ product }) {
  const { setAttributes } = useShop();
  const attributes = product.attributes || [];
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    if (!trimmedKey || !trimmedValue) {
      setError("Vui lòng nhập cả tên và giá trị thuộc tính.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const next = [...attributes, { key: trimmedKey, value: trimmedValue }];
      await setAttributes(product.id, next);
      setKey("");
      setValue("");
    } catch (err) {
      setError(err.message || "Thêm thuộc tính thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(index) {
    setError("");
    try {
      const next = attributes.filter((_, i) => i !== index);
      await setAttributes(product.id, next);
    } catch (err) {
      setError(err.message || "Xoá thuộc tính thất bại.");
    }
  }

  return (
    <section className="border border-gray-200 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Thuộc tính sản phẩm</h2>
      <p className="text-sm text-gray-500 mb-4">
        Ví dụ: Trọng lượng, Xuất xứ, Thành phần, Hạn sử dụng, Kích thước...
      </p>

      {attributes.length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">Chưa có thuộc tính nào.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {attributes.map((attr, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 border border-gray-100 bg-gray-50 rounded-md px-3 py-2"
            >
              <p className="text-sm text-gray-700 min-w-0 truncate">
                <span className="font-medium text-gray-900">{attr.key}:</span> {attr.value}
              </p>
              <button
                onClick={() => handleRemove(i)}
                className="text-xs text-red-600 hover:text-red-700 shrink-0"
              >
                Xoá
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Tên thuộc tính (VD: Trọng lượng)"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Giá trị (VD: 500g)"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        />
        <button
          type="submit"
          disabled={saving}
          className="shrink-0 text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Đang lưu..." : "Thêm thuộc tính"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </section>
  );
}

export default function EditProductPage() {
  const { id } = useParams();
  const { user, hydrated: authHydrated } = useAuth();
  const { myShop, myShopProducts, hydrated: shopHydrated } = useShop();

  if (!authHydrated || !shopHydrated) return null;

  if (!user || !myShop) {
    return (
      <main className="flex-1 bg-amber-50">
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <p className="text-gray-600 mb-6">Bạn cần đăng ký gian hàng trước.</p>
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

  const product = myShopProducts.find((p) => p.id === id);

  if (!product) {
    return (
      <main className="flex-1 bg-white">
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <p className="text-gray-600 mb-6">
            Không tìm thấy sản phẩm này trong gian hàng của bạn.
          </p>
          <Link
            href="/seller"
            className="bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
          >
            Về gian hàng
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/seller" className="text-sm text-gray-500 hover:text-gray-900">
          ← Về gian hàng
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2 mb-1">{product.name}</h1>
        <p className="text-sm text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 w-fit mb-8">
          {product.category}
        </p>

        <ImagesSection product={product} />
        <PriceSection product={product} />
        <PromotionSection product={product} />
        <AttributesSection product={product} />
      </div>
    </main>
  );
}
