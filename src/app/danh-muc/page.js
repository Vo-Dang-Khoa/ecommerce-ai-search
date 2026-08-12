// Server Component — liệt kê 11 danh mục cha, fetch trực tiếp từ Supabase
// trên server để tối ưu SEO (nội dung có sẵn trong HTML đầu tiên, không
// cần chờ JS chạy như ShopProvider phía client).
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export const metadata = {
  title: "Danh mục sản phẩm - ShopAI",
  description: "Khám phá toàn bộ ngành hàng của ShopAI theo danh mục.",
};

export default async function CategoriesIndexPage() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .is("parent_id", null)
    .order("sort_order", { ascending: true });

  const rootCategories = error ? [] : data || [];

  return (
    <main className="flex-1 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Danh mục sản phẩm</h1>
        <p className="text-gray-600 mb-8">Chọn 1 ngành hàng để xem sản phẩm</p>

        {rootCategories.length === 0 ? (
          <p className="text-gray-500">
            Chưa có danh mục nào. Hãy chạy{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">
              supabase/schema.sql
            </code>{" "}
            (bản mới nhất) trong Supabase SQL Editor để khởi tạo 11 danh mục.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rootCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/danh-muc/${cat.slug}`}
                className="border border-gray-200 rounded-xl p-5 flex items-center hover:border-gray-900 hover:shadow-md transition-all"
              >
                <h2 className="font-semibold text-gray-900">{cat.name}</h2>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
