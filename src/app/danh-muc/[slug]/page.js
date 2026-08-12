// Server Component (KHÔNG "use client") — chạy trên server, fetch trực
// tiếp Supabase để tạo <title>/<meta description> đúng cho từng danh mục
// TRƯỚC khi trả HTML về trình duyệt, giúp Google/bot đọc được nội dung
// ngay từ lần tải đầu tiên (không phải chờ JS chạy xong như trang cũ
// /products?category=...). Danh sách sản phẩm + bộ lọc bên trong vẫn dùng
// Context phía client (CategoryBrowser) để tái dùng state giỏ hàng/đăng
// nhập hiện có của dự án.
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import CategoryBrowser from "./CategoryBrowser";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { data } = await supabase
    .from("categories")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) {
    return { title: "Danh mục không tồn tại - ShopAI" };
  }

  return {
    title: `${data.name} - ShopAI`,
    description: `Khám phá các sản phẩm thuộc danh mục ${data.name} tại ShopAI.`,
  };
}

export default async function CategoryPage({ params }) {
  const { slug } = await params;
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  // Danh mục không tồn tại (slug sai, hoặc project chưa chạy
  // supabase/schema.sql bản v8) -> trang 404 chuẩn của Next.js.
  if (!category) notFound();

  return (
    <main className="flex-1 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <CategoryBrowser slug={slug} />
      </div>
    </main>
  );
}
