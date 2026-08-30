"use client";

import { useEffect, useState } from "react";

// Cuộn xuống quá ngưỡng này (px) mới hiện nút — tránh hiện ngay từ đầu khi
// trang còn ngắn/chưa cuộn gì.
const SHOW_AFTER_PX = 400;

/**
 * Nút nổi "Về đầu trang" — đặt Ở GIỮA cạnh dưới màn hình (khác nút chat AI
 * ở góc dưới bên phải, xem ChatWidget.js, nên không bị chồng lên nhau), chỉ
 * hiện khi người dùng đã cuộn xuống quá SHOW_AFTER_PX. Bấm vào cuộn MƯỢT về
 * đầu trang (nhờ `scroll-behavior: smooth` khai báo sẵn ở globals.css).
 *
 * Đặt 1 LẦN DUY NHẤT ở RootLayout (layout.js, ngang hàng với Header/
 * ChatWidget) nên tự áp dụng cho MỌI trang dài của web — không cần thêm lại
 * ở từng trang riêng lẻ.
 */
export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Về đầu trang"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-gray-900/90 text-white text-sm font-medium pl-3 pr-4 py-2 rounded-full shadow-lg hover:bg-gray-800 transition-colors"
    >
      <span aria-hidden="true">↑</span>
      Về đầu trang
    </button>
  );
}
