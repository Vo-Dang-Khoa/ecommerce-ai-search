"use client";

import { useRef, useState } from "react";

function formatTime(sec) {
  const safe = Math.max(0, sec || 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Khung "Cắt video" hiện khi video vừa chọn/quay dài hơn `maxSeconds` cho
 * phép — người bán kéo 2 thanh trượt để chọn đoạn (start, end) cần giữ lại
 * (tối đa `maxSeconds`), có thể xem thử trước khi xác nhận cắt.
 *
 * @param {{
 *   sourceUrl: string,
 *   duration: number,
 *   maxSeconds: number,
 *   processing: boolean,
 *   onConfirm: (start: number, end: number) => void,
 *   onCancel: () => void,
 * }} props
 */
export default function VideoTrimModal({ sourceUrl, duration, maxSeconds, processing, onConfirm, onCancel }) {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(duration, maxSeconds));
  const videoRef = useRef(null);

  function handleStartChange(value) {
    let newStart = Math.min(value, Math.max(end - 1, 0));
    newStart = Math.max(0, newStart);
    setStart(newStart);
    if (end - newStart > maxSeconds) setEnd(Math.min(duration, newStart + maxSeconds));
    if (videoRef.current) videoRef.current.currentTime = newStart;
  }

  function handleEndChange(value) {
    let newEnd = Math.max(value, start + 1);
    if (newEnd - start > maxSeconds) newEnd = start + maxSeconds;
    newEnd = Math.min(newEnd, duration);
    setEnd(newEnd);
    if (videoRef.current) videoRef.current.currentTime = newEnd;
  }

  function handlePreview() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = start;
    video.play().catch(() => {});
    const onTimeUpdate = () => {
      if (video.currentTime >= end) {
        video.pause();
        video.removeEventListener("timeupdate", onTimeUpdate);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
  }

  const selectedLength = Math.max(end - start, 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg p-5 max-w-sm w-full max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-gray-900 mb-1">Video dài hơn {maxSeconds} giây</h3>
        <p className="text-sm text-gray-600 mb-4">
          Chọn đoạn muốn giữ lại (tối đa {maxSeconds} giây) — phần còn lại sẽ được cắt bỏ ngay
          tại đây, không cần dùng ứng dụng khác.
        </p>

        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- video xem trước để chọn đoạn cắt */}
        <video
          ref={videoRef}
          src={sourceUrl}
          playsInline
          muted
          className="w-full rounded-md border border-gray-200 bg-black mb-3"
        />

        <label className="block text-xs text-gray-500 mb-1">Bắt đầu: {formatTime(start)}</label>
        <input
          type="range"
          min={0}
          max={Math.max(duration - 1, 0)}
          step={0.1}
          value={start}
          onChange={(e) => handleStartChange(Number(e.target.value))}
          disabled={processing}
          className="w-full mb-3"
        />

        <label className="block text-xs text-gray-500 mb-1">Kết thúc: {formatTime(end)}</label>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={end}
          onChange={(e) => handleEndChange(Number(e.target.value))}
          disabled={processing}
          className="w-full mb-2"
        />

        <p className="text-xs text-gray-500 mb-3">Đoạn sẽ giữ lại: {formatTime(selectedLength)}</p>

        <button
          type="button"
          onClick={handlePreview}
          disabled={processing}
          className="text-xs text-gray-600 underline mb-4 block disabled:opacity-50"
        >
          ▶️ Xem thử đoạn đã chọn
        </button>

        {processing && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
            Đang cắt video, vui lòng chờ (thời gian xử lý khoảng bằng đúng độ dài đoạn đã chọn)...
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:border-gray-900 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => onConfirm(start, end)}
            disabled={processing || selectedLength < 1}
            className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {processing ? "Đang cắt..." : "✂️ Cắt video"}
          </button>
        </div>
      </div>
    </div>
  );
}
