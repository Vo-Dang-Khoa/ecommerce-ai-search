"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Đoạn văn bản tự giới hạn còn tối đa `lines` dòng (Tailwind `line-clamp`) —
 * CHỈ hiện nút mũi tên "Xem thêm/Thu gọn" khi nội dung THỰC SỰ bị cắt bớt
 * (so sánh scrollHeight/clientHeight của chính thẻ chữ sau khi render),
 * tránh hiện nút thừa cho sản phẩm có tên/mô tả ngắn.
 *
 * Dùng ở ProductCard.js cho TÊN và MÔ TẢ sản phẩm, kèm `minHeightClass` để
 * luôn CHỪA SẴN đúng chiều cao của `lines` dòng dù chữ ngắn hay dài — nhờ
 * vậy mọi thẻ sản phẩm trong cùng 1 hàng lưới luôn cao bằng nhau, ảnh/tên/
 * giá/nút hành động luôn thẳng hàng, dù độ dài chữ khác nhau.
 *
 * Nút "Xem thêm" là <button> RIÊNG, KHÔNG lồng bên trong bất kỳ <a>/Link
 * nào (component này không tự bọc Link) — gọi `e.preventDefault()` +
 * `e.stopPropagation()` khi bấm để không ảnh hưởng tới Link cha bọc ngoài
 * (nếu có) ở nơi gọi.
 *
 * @param {{
 *   text: string,
 *   lines?: number,
 *   as?: "p" | "h3" | "span",
 *   textClassName?: string,
 *   minHeightClass?: string,
 *   wrapperClassName?: string,
 * }} props
 */
// Tailwind quét CLASS NAME dạng CHUỖI TĨNH trong mã nguồn để biết cần sinh
// CSS nào — `line-clamp-${lines}` (ghép chuỗi lúc chạy) sẽ KHÔNG được nhận
// diện, khiến CSS clamp không được sinh ra. Vì vậy cần khai báo sẵn đủ các
// tên class dạng chữ (literal) ở đây rồi tra theo `lines`.
const LINE_CLAMP_CLASSES = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
};

export default function ClampedText({
  text,
  lines = 2,
  as: Tag = "p",
  textClassName = "",
  minHeightClass = "",
  wrapperClassName = "",
}) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    // Đo tràn chữ Ở TRẠNG THÁI ĐANG CLAMP — chỉ đo khi chưa mở rộng, vì lúc
    // mở rộng thẻ không còn bị cắt (scrollHeight === clientHeight) nên
    // không đo lại để tránh nút "Xem thêm" tự ẩn đi khi đang mở.
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded, lines]);

  function toggleExpanded(e) {
    e.preventDefault();
    e.stopPropagation();
    setExpanded((v) => !v);
  }

  return (
    <div className={wrapperClassName}>
      <Tag
        ref={ref}
        className={`${textClassName} ${minHeightClass} ${
          expanded ? "" : LINE_CLAMP_CLASSES[lines] || "line-clamp-2"
        }`}
      >
        {text}
      </Tag>
      {overflowing && (
        <button
          type="button"
          onClick={toggleExpanded}
          className="text-xs text-amber-700 hover:text-amber-800 font-medium mt-0.5 inline-flex items-center gap-0.5"
        >
          {expanded ? "Thu gọn ▲" : "Xem thêm ▾"}
        </button>
      )}
    </div>
  );
}
