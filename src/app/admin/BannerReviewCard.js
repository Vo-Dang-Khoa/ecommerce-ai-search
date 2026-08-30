"use client";

import { useState } from "react";
import { useShop } from "../providers";
import { REVIEW_STATUS_LABEL, REVIEW_STATUS_CLASS } from "@/lib/banners";
import AdBanner from "../components/AdBanner";

// v15: 1 thẻ banner trong hàng chờ duyệt ở /admin/banners — xem
// supabase/schema.sql mục 11 (trigger shop_banners_guard_review) cho phần
// chặn ở server. "Chấp nhận" áp dụng ngay; "Yêu cầu chỉnh sửa"/"Từ chối"
// bung thêm ô nhập lý do (bắt buộc) trước khi xác nhận, để người bán biết
// cần sửa gì ở trang /seller.
export default function BannerReviewCard({ banner }) {
  const { reviewShopBanner } = useShop();
  const [noteMode, setNoteMode] = useState(null); // null | "rejected" | "changes_requested"
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function openNote(status) {
    setNoteMode(status);
    setNote("");
    setError("");
  }

  function cancelNote() {
    setNoteMode(null);
    setNote("");
    setError("");
  }

  async function handleApprove() {
    setBusy(true);
    setError("");
    try {
      await reviewShopBanner(banner.id, { status: "approved" });
    } catch (err) {
      setError(err.message || "Duyệt banner thất bại, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmNote() {
    if (!note.trim()) {
      setError("Vui lòng nhập lý do/hướng dẫn chỉnh sửa cho người bán.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await reviewShopBanner(banner.id, { status: noteMode, note: note.trim() });
      setNoteMode(null);
      setNote("");
    } catch (err) {
      setError(err.message || "Cập nhật trạng thái banner thất bại, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            Gian hàng: {banner.shopName || "(không rõ)"}
          </h3>
          {banner.reviewedAt && (
            <p className="text-xs text-gray-400 mt-0.5">
              Xử lý lần gần nhất: {new Date(banner.reviewedAt).toLocaleString("vi-VN")}
            </p>
          )}
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${REVIEW_STATUS_CLASS[banner.reviewStatus]}`}
        >
          {REVIEW_STATUS_LABEL[banner.reviewStatus]}
        </span>
      </div>

      <AdBanner banner={banner} />

      {banner.reviewNote && (
        <p className="text-xs text-gray-500">
          Ghi chú lần duyệt trước: <span className="italic">{banner.reviewNote}</span>
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {noteMode ? (
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-700">
            {noteMode === "rejected" ? "Lý do từ chối" : "Hướng dẫn cần chỉnh sửa"}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={
              noteMode === "rejected"
                ? "VD: Ảnh banner không liên quan đến nội dung quảng cáo."
                : "VD: Vui lòng đổi ảnh rõ nét hơn và rút gọn tiêu đề."
            }
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirmNote}
              disabled={busy}
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
            >
              {busy ? "Đang lưu..." : "Xác nhận"}
            </button>
            <button
              type="button"
              onClick={cancelNote}
              disabled={busy}
              className="text-sm text-gray-600 px-4 py-2 hover:text-gray-900 disabled:opacity-50"
            >
              Huỷ
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleApprove}
            disabled={busy}
            className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            Chấp nhận
          </button>
          <button
            type="button"
            onClick={() => openNote("changes_requested")}
            disabled={busy}
            className="text-sm border border-amber-300 text-amber-700 px-4 py-2 rounded-md hover:bg-amber-50 disabled:opacity-50"
          >
            Yêu cầu chỉnh sửa
          </button>
          <button
            type="button"
            onClick={() => openNote("rejected")}
            disabled={busy}
            className="text-sm border border-red-300 text-red-700 px-4 py-2 rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            Từ chối
          </button>
        </div>
      )}
    </div>
  );
}
