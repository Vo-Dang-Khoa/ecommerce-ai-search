"use client";

import dynamic from "next/dynamic";

// Next.js CHỈ cho phép `next/dynamic` với `{ ssr: false }` bên trong 1
// Client Component — gọi thẳng trong layout.js (Server Component) sẽ bị lỗi
// build "'ssr: false' is not allowed with 'next/dynamic' in Server
// Components". Vì vậy tách riêng ra file "use client" này, layout.js chỉ
// cần import + render <ChatWidgetLoader /> như 1 component bình thường.
//
// ChatWidget (khung chat AI nổi góc màn hình) không phải nội dung chính của
// trang và không cần render sẵn ở server — tải kèm JS của nó SAU KHI phần
// đầu trang (Header + nội dung chính) đã xong, tránh chặn/chia băng thông
// với chúng ngay từ đầu, giúp trang ưu tiên tải phần đầu trước.
const ChatWidget = dynamic(() => import("./ChatWidget"), { ssr: false });

export default function ChatWidgetLoader() {
  return <ChatWidget />;
}
