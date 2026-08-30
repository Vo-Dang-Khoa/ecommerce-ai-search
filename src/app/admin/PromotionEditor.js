"use client";

import { useEffect, useState } from "react";
import { useShop } from "../providers";
import { uploadCategoryPromotionImage } from "@/lib/shops";
import { BANNER_THEMES } from "@/lib/banners";
import { getPromotionStatus, PROMOTION_STATUS_LABEL } from "@/lib/promotions";
import PromotionBanner from "../components/PromotionBanner";
import BannerImageUploader from "../seller/BannerImageUploader";

const STATUS_TEXT_CLASS = {
  ongoing: "text-emerald-600",
  upcoming: "text-sky-600",
  ended: "text-gray-400",
};

function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/**
 * 1 dòng quản lý khuyến mãi của 1 ngành hàng ở /admin — thu gọn thành 1
 * hàng tóm tắt (tên ngành hàng + trạng thái) khi chưa sửa, bung ra thành
 * form đầy đủ (ảnh, tiêu đề, mô tả, ngày bắt đầu/kết thúc, tông màu, bật/
 * tắt) khi bấm "Sửa"/"+ Tạo". Ảnh dùng LẠI BannerImageUploader.js (đã có
 * sẵn resize + gợi ý cắt theo khung banner) từ tính năng banner gian hàng,
 * chỉ khác nơi lưu (uploadCategoryPromotionImage, bucket
 * "category-promotions" thay vì "shop-banners").
 *
 * @param {{
 *   category: {id: string, name: string},
 *   promotion: object|null,
 *   isOpen: boolean,
 *   onOpen: () => void,
 *   onClose: () => void,
 * }} props
 */
export default function PromotionEditor({ category, promotion, isOpen, onOpen, onClose }) {
  const { savePromotion, deletePromotion } = useShop();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [theme, setTheme] = useState("amber");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
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

  function startEditing() {
    if (promotion) {
      setTitle(promotion.title);
      setSubtitle(promotion.subtitle);
      setLinkUrl(promotion.linkUrl);
      setTheme(promotion.theme);
      setStartAt(toDatetimeLocalValue(promotion.startAt));
      setEndAt(toDatetimeLocalValue(promotion.endAt));
      setActive(promotion.active);
    } else {
      setTitle("");
      setSubtitle("");
      setLinkUrl("");
      setTheme("amber");
      setStartAt("");
      setEndAt("");
      setActive(true);
    }
    setImageFile(null);
    setError("");
    onOpen();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề khuyến mãi.");
      return;
    }
    if (!startAt || !endAt) {
      setError("Vui lòng nhập đầy đủ ngày bắt đầu và kết thúc.");
      return;
    }
    if (new Date(endAt) <= new Date(startAt)) {
      setError("Ngày kết thúc phải sau ngày bắt đầu.");
      return;
    }

    let imageUrl = promotion?.imageUrl || "";
    if (imageFile) {
      setUploading(true);
      try {
        imageUrl = await uploadCategoryPromotionImage(imageFile, category.id);
      } catch (err) {
        setError(err.message || "Tải ảnh lên thất bại, vui lòng thử lại.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    if (!imageUrl) {
      setError("Vui lòng chọn ảnh cho khuyến mãi.");
      return;
    }

    setSaving(true);
    try {
      await savePromotion(category.id, {
        title: title.trim(),
        subtitle: subtitle.trim(),
        imageUrl,
        linkUrl: linkUrl.trim(),
        theme,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        active,
      });
      setImageFile(null);
      onClose();
    } catch (err) {
      setError(err.message || "Lưu khuyến mãi thất bại, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Xoá khuyến mãi của "${category.name}"?`)) return;
    try {
      await deletePromotion(category.id);
    } catch (err) {
      alert(err.message || "Xoá khuyến mãi thất bại, vui lòng thử lại.");
    }
  }

  const busy = uploading || saving;
  const status = getPromotionStatus(promotion);

  if (!isOpen) {
    return (
      <div className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl p-4 bg-white">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{category.name}</h3>
          {promotion ? (
            <p className="text-xs text-gray-500 mt-1 truncate">
              {promotion.title} · <span className={STATUS_TEXT_CLASS[status]}>{PROMOTION_STATUS_LABEL[status]}</span>
              {!promotion.active && " · Đang tắt"}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">Chưa có khuyến mãi</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={startEditing}
            className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md px-3 py-1.5"
          >
            {promotion ? "Sửa" : "+ Tạo"}
          </button>
          {promotion && (
            <button type="button" onClick={handleDelete} className="text-sm text-red-600 hover:text-red-700">
              Xoá
            </button>
          )}
        </div>
      </div>
    );
  }

  const previewPromotion = {
    title: title || "Tiêu đề khuyến mãi",
    subtitle,
    imageUrl: imagePreviewUrl || promotion?.imageUrl || "",
    linkUrl: "",
    theme,
    startAt: startAt ? new Date(startAt).toISOString() : new Date().toISOString(),
    endAt: endAt ? new Date(endAt).toISOString() : new Date().toISOString(),
    active,
    categoryName: category.name,
  };

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-xl p-5 bg-white flex flex-col gap-4">
      <h3 className="font-semibold text-gray-900">{category.name}</h3>

      {previewPromotion.imageUrl && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Xem trước</p>
          <PromotionBanner promotion={previewPromotion} />
        </div>
      )}

      <div>
        <label className="text-sm text-gray-700 block mb-1.5">Ảnh khuyến mãi</label>
        <BannerImageUploader disabled={busy} onSelected={setImageFile} />
        <p className="text-xs text-gray-400 mt-1.5">
          Ảnh quá lớn (trên 1600px hoặc 1.5MB) sẽ được tự động thu nhỏ cho phù hợp.
          {promotion && !imageFile && " Bỏ qua nếu muốn giữ ảnh hiện tại."}
        </p>
      </div>

      <div>
        <label className="text-sm text-gray-700 block mb-1.5">Tiêu đề</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Đại tiệc khuyến mãi cuối tuần"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        />
      </div>

      <div>
        <label className="text-sm text-gray-700 block mb-1.5">Mô tả ngắn (tuỳ chọn)</label>
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="VD: Giảm đến 30% toàn bộ ngành hàng"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-700 block mb-1.5">Bắt đầu</label>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
          />
        </div>
        <div>
          <label className="text-sm text-gray-700 block mb-1.5">Kết thúc</label>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
          />
        </div>
      </div>
      <p className="text-xs text-gray-400 -mt-2">
        Trạng thái &quot;Sắp diễn ra&quot;/&quot;Đang diễn ra&quot; tự tính theo 2 mốc thời gian
        này, không cần chọn thủ công.
      </p>

      <div>
        <label className="text-sm text-gray-700 block mb-1.5">Liên kết khi bấm vào (tuỳ chọn)</label>
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="VD: /danh-muc/thuc-pham-che-bien-do-uong"
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
        Hiển thị khuyến mãi này trên web
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
        >
          {uploading ? "Đang tải ảnh..." : saving ? "Đang lưu..." : "Lưu khuyến mãi"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="text-sm text-gray-600 px-4 py-2 hover:text-gray-900 disabled:opacity-50"
        >
          Huỷ
        </button>
      </div>
    </form>
  );
}
