"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Tin nhắn chào mừng hiện sẵn trên UI nhưng KHÔNG gửi lên /api/chat (đánh
// dấu synthetic: true, lọc ra ở handleSend) — vì Claude API bắt buộc lượt
// đầu tiên trong `messages` phải là role "user", không được bắt đầu bằng
// "assistant".
const WELCOME_MESSAGE = {
  role: "assistant",
  content:
    "Xin chào! Mình là trợ lý AI của ShopAI 🍰 — mình có thể giúp bạn tìm bánh phù hợp, trả lời câu hỏi về giao hàng/thanh toán, hoặc tra cứu đơn hàng bạn đã đặt (nếu bạn đã đăng nhập). Bạn cần gì nhỉ?",
  synthetic: true,
};

// Server trả lời có thể chèn cú pháp [Tên sản phẩm](product:id) để gợi ý
// sản phẩm cụ thể (xem system prompt ở src/app/api/chat/route.js) — hàm
// này tách chuỗi đó thành đoạn text thường + link sản phẩm dạng chip, bấm
// vào sang thẳng trang /san-pham/[id].
function renderMessageContent(text) {
  const parts = [];
  const regex = /\[([^\]]+)\]\(product:([a-zA-Z0-9-]+)\)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    parts.push(
      <Link
        key={key++}
        href={`/san-pham/${match[2]}`}
        className="inline-block text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 text-xs font-medium hover:bg-amber-100 mx-0.5 align-middle"
      >
        {match[1]} →
      </Link>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }
  return parts.length > 0 ? parts : text;
}

// Khung chat AI nổi ở góc màn hình, hiện trên MỌI trang (đặt trong
// layout.js) — tư vấn sản phẩm dạng hội thoại + trả lời chính sách + tra
// cứu đơn hàng thật của khách đang đăng nhập.
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open, sending]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setSending(true);

    try {
      // Gửi kèm access_token của phiên đăng nhập hiện tại (nếu có) để
      // server tra cứu ĐÚNG đơn hàng của khách này (qua RLS Supabase) khi
      // AI cần gọi công cụ lookup_recent_orders — xem route.js.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.filter((m) => !m.synthetic),
          accessToken,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Có lỗi xảy ra, vui lòng thử lại.");
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Không thể kết nối tới máy chủ. Kiểm tra mạng và thử lại.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Đóng trợ lý AI" : "Mở trợ lý AI"}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gray-900 text-white text-2xl shadow-lg hover:bg-gray-800 transition-colors flex items-center justify-center"
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[90vw] max-w-sm h-[70vh] max-h-[560px] bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-gray-900 text-white px-4 py-3 shrink-0">
            <p className="font-semibold text-sm">Trợ lý AI ShopAI 🍰</p>
            <p className="text-xs text-gray-300">Hỏi về sản phẩm, đơn hàng, chính sách...</p>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] text-sm rounded-xl px-3 py-2 whitespace-pre-line ${
                  m.role === "user"
                    ? "self-end bg-gray-900 text-white"
                    : "self-start bg-gray-100 text-gray-800"
                }`}
              >
                {m.role === "assistant" ? renderMessageContent(m.content) : m.content}
              </div>
            ))}
            {sending && (
              <div className="self-start bg-gray-100 text-gray-500 text-sm rounded-xl px-3 py-2">
                Đang trả lời...
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600 px-4 pb-1 shrink-0">{error}</p>}

          <form onSubmit={handleSend} className="border-t border-gray-200 p-2 flex gap-2 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi..."
              disabled={sending}
              className="flex-1 border border-gray-300 rounded-full px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Gửi"
              className="bg-gray-900 text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-800 disabled:opacity-50 shrink-0"
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
