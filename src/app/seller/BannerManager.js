"use client";

import { useEffect, useState } from "react";
import { useShop } from "../providers";
import { uploadShopBanner } from "@/lib/shops";
import { BANNER_THEMES } from "@/lib/banners";
import AdBanner from "../components/AdBanner";
import BannerImageUploader from "./BannerImageUploader";

// Panel "Banner quảng cáo" trong trang quản lý gian hàng (/seller) — v13,
// xem supabase/schema.sql mục 5D. Mỗi gian hàng chỉ có TỐI ĐA 1 banner
// (saveBanner ở ShopProvider dùng upsert theo shop_id), banner này sau đó
// được luân phiên hiển thị ở nhiều trang khác của web (xem AdSlot.js) —
// không chỉ hiện trên trang của chính gian hàng này.
export default function BannerManager({ shop }) {
  const { myBanner, saveBanner, deleteBanner } = useShop();

  const [mode, setMode] = useState("view"); // "view" | "edit"
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [theme, setTheme] = useState("amber");
  const [active, setActive] = useState(true);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function startCreate() {
    setTitle("");
    setSubtitle("");
    setLinkUrl("");
    setTheme("amber");
    setActive(true);
    setImageFile(null);
    setError("");
    setMode("edit");
  }

  function startEdit() {
    if (!myBanner) return;
    setTitle(myBanner.title);
    setSubtitle(myBanner.subtitle);
    setLinkUrl(myBanner.linkUrl);
    setTheme(myBanner.theme);
    setActive(myBanner.active);
    setImageFile(null);
    setError("");
    setMode("edit");
  }

  function cancelEdit() {
    setImageFile(null);
    setError("");
    setMode("view");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề banner.");
      return;
    }

    let imageUrl = myBanner?.imageUrl || "";
    if (imageFile) {
      setUploading(true);
      try {
        imageUrl = await uploadShopBanner(imageFile, shop.id);
      } catch (err) {
        setError(err.message || "Tải ảnh banner lên thất bại, vui lòng thử lại.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    if (!imageUrl) {
      setError("Vui lòng chọn ảnh cho banner.");
      return;
    }

    setSaving(true);
    try {
      await saveBanner({
        title: title.trim(),
        subtitle: subtitle.trim(),
        imageUrl,
        linkUrl: linkUrl.trim(),
        theme,
        active,
      });
      setImageFile(null);
      setMode("view");
    } catch (err) {
      setError(err.message || "Lưu banner thất bại, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Xoá banner quảng cáo của gian hàng?")) return;
    try {
      await deleteBanner();
    } catch (err) {
      alert(err.message || "Xoá banner thất bại, vui lòng thử lại.");
    }
  }

  async function handleToggleActive() {
    if (!myBanner) return;
    try {
      await saveBanner({
        title: myBanner.title,
        subtitle: myBanner.subtitle,
        imageUrl: myBanner.imageUrl,
        linkUrl: myBanner.linkUrl,
        theme: myBanner.theme,
        active: !myBanner.active,
      });
    } catch (err) {
      alert(err.message || "Cập nhật trạng thái banner thất bại, vui lòng thử lại.");
    }
  }

  const busy = uploading || saving;

  if (mode === "view") {
    return (
      <div className="border border-gray-200 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Banner quảng cáo</h2>
          {myBanner ? (
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleToggleActive}
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  myBanner.active
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {myBanner.active ? "● Đang hiển thị" : "○ Đang tắt"}
              </button>
              <button
                type="button"
                onClick={startEdit}
                className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md px-3 py-1.5"
              >
                Sửa
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Xoá
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startCreate}
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800"
            >
              + Tạo banner
            </button>
          )}
        </div>

        {myBanner ? (
          <AdBanner banner={myBanner} />
        ) : (
          <p className="text-gray-500 text-sm py-6 text-center border border-dashed border-gray-300 rounded-xl">
            Gian hàng chưa có banner quảng cáo nào. Banner sẽ luân phiên hiển thị ở trang chủ,
            danh sách/danh mục sản phẩm và trang chi tiết sản phẩm.
          </p>
        )}
      </div>
    );
  }

  const previewBanner = {
    title: title || "Tiêu đề banner",
    subtitle,
    imageUrl: imagePreviewUrl || myBanner?.imageUrl || "",
    linkUrl: "",
    theme,
    shopName: shop.name,
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-200 rounded-xl p-6 mb-8 flex flex-col gap-4"
    >
      <h2 className="text-lg font-bold text-gray-900">
        {myBanner ? "Sửa banner quảng cáo" : "Tạo banner quảng cáo"}
      </h2>

      {previewBanner.imageUrl && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Xem trước</p>
          <AdBanner banner={previewBanner} />
        </div>
      )}

      <div>
        <label className="text-sm text-gray-700 block mb-1.5">Ảnh banner</label>
        <BannerImageUploader disabled={busy} onSelected={setImageFile} />
        <p className="text-xs text-gray-400 mt-1.5">
          Ảnh quá lớn (trên 1600px hoặc 1.5MB) sẽ được tự động thu nhỏ cho phù hợp.
          {myBanner && !imageFile && " Bỏ qua nếu muốn giữ ảnh hiện tại."}
        </p>
      </div>

      <div>
        <label className="text-sm text-gray-700 block mb-1.5">Tiêu đề</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Giảm 20% bánh sinh nhật tuần này"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        />
      </div>

      <div>
        <label className="text-sm text-gray-700 block mb-1.5">Mô tả ngắn (tuỳ chọn)</label>
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="VD: Áp dụng khi đặt trước 24 giờ"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        />
      </div>

      <div>
        <label className="text-sm text-gray-700 block mb-1.5">Liên kết khi bấm vào (tuỳ chọn)</label>
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="VD: /products?category=Bánh sinh nhật"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        />
      </div>

      <div>
        <label className="text-sm text-gray-700 block mb-2">Tông màu</label>
        <div className="flex flex-wrap gap-2">
          {BANNER_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              title={t.label}
              className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.swatch} ${
                theme === t.id ? "ring-2 ring-offset-2 ring-gray-900" : ""
              }`}
              aria-label={t.label}
            />
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Hiển thị banner này trên web
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
        >
          {uploading ? "Đang tải ảnh..." : saving ? "Đang lưu..." : "Lưu banner"}
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          disabled={busy}
          className="text-sm text-gray-600 px-4 py-2 hover:text-gray-900 disabled:opacity-50"
        >
          Huỷ
        </button>
      </div>
    </form>
  );
}
