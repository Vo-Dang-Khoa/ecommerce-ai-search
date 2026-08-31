import dynamic from "next/dynamic";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "./components/Header";
import BackToTopButton from "./components/BackToTopButton";
import { Providers } from "./providers";
import "./globals.css";

// ChatWidget (khung chat AI nổi góc màn hình) KHÔNG phải nội dung chính của
// trang và không cần render sẵn ở server (ssr: false) — tải kèm JS của nó
// SAU KHI phần đầu trang (Header + nội dung chính) đã tải xong, thay vì
// chặn/chia sẻ băng thông với chúng ngay từ đầu. Đây là 1 phần của việc ưu
// tiên tải phần đầu trang trước rồi mới tải dần các phần phụ, tránh giật
// lag lúc mở trang.
const ChatWidget = dynamic(() => import("./components/ChatWidget"), { ssr: false });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "ShopAI - Bánh ngon mỗi ngày",
  description: "Cửa hàng bánh trực tuyến với tìm kiếm sản phẩm bằng AI",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <Header />
          {children}
          <ChatWidget />
          <BackToTopButton />
        </Providers>
      </body>
    </html>
  );
}
