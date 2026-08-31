"use client";

import { useEffect, useRef, useState } from "react";

// Cuộn gần tới đâu (px, tính TRƯỚC khi thật sự vào khung nhìn) thì mới bắt
// đầu tải nội dung thật — đủ lớn để nội dung đã kịp hiện ra mượt mà lúc
// người dùng cuộn tới nơi, không đợi tới khi lọt hẳn vào khung nhìn mới
// tải (sẽ bị giật/trễ 1 nhịp).
const PRELOAD_MARGIN = "600px 0px";

/**
 * Bọc quanh 1 khối nội dung "nặng" (nhiều ảnh/sản phẩm) để trì hoãn việc
 * tải/dựng nội dung đó cho tới khi người dùng CUỘN GẦN TỚI nó — dùng ở
 * trang /products (ProductsBrowser.js) để 12 khối ngành hàng không cùng tải
 * ảnh một lượt lúc mở trang (gây giật/lag), mà tải DẦN DẦN theo đúng thứ tự
 * cuộn từ đầu trang xuống chân trang, giống cách các sàn TMĐT lớn làm.
 *
 * - `eager`: bỏ qua cơ chế trì hoãn, dựng nội dung thật NGAY LẬP TỨC — dùng
 *   cho vài khối ĐẦU TIÊN (luôn nằm trong/gần khung nhìn lúc mở trang) để
 *   phần đầu trang vẫn hiện đầy đủ ngay, không phải chờ.
 * - Khi chưa tới lượt tải, hiện khung xám "nhấp nháy" (skeleton) CÙNG `id`
 *   và kiểu cuộn-neo (`scroll-mt-24`) với khối thật bên trong — nhờ vậy nút
 *   bấm nhanh ngành hàng ở ProductsBrowser.js (neo `#industry-<id>`) vẫn
 *   cuộn ĐÚNG vị trí ngay cả khi khối đó chưa kịp tải nội dung thật; trình
 *   duyệt cuộn tới đâu, khung xám lọt gần khung nhìn tới đó và tự tải luôn.
 *
 * @param {{id?: string, eager?: boolean, minHeight?: number, children: React.ReactNode}} props
 */
export default function LazySection({ id, eager = false, minHeight = 520, children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    // Trình duyệt quá cũ không hỗ trợ IntersectionObserver -> hiện luôn nội
    // dung thật, không chặn người dùng vì lý do tối ưu hiệu năng.
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: PRELOAD_MARGIN }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  if (visible) return children;

  return (
    <div id={id} ref={ref} className="mb-14 scroll-mt-24 animate-pulse" style={{ minHeight }}>
      <div className="h-6 w-56 bg-gray-200 rounded mb-4" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[280px] bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
