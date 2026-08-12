// Server Component (KHÔNG "use client") — tạo <title>/<meta description>
// đúng cho từng sản phẩm TRƯỚC khi trả HTML về trình duyệt (tốt cho SEO),
// giống cách làm ở trang /danh-muc/[slug]. Nội dung chi tiết + hành động
// (thêm giỏ/mua ngay) vẫn dùng Context phía client (ProductDetail) để tái
// dùng state giỏ hàng/đăng nhập hiện có của dự án.
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PRODUCTS } from "@/lib/products";
import ProductDetail from "./ProductDetail";

// Sản phẩm demo tĩnh (id dạng "bsn-1", không phải uuid) tra cứu trực tiếp
// trong src/lib/products.js; sản phẩm thật (uuid) tra cứu qua Supabase.
async function findProductForMetadata(id) {
  const staticProduct = PRODUCTS.find((p) => p.id === id);
  if (staticProduct) return staticProduct;

  const { data } = await supabase
    .from("products")
    .select("name, description")
    .eq("id", id)
    .maybeSingle();

  return data ? { name: data.name, desc: data.description } : null;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await findProductForMetadata(id);

  if (!product) {
    return { title: "Sản phẩm không tồn tại - ShopAI" };
  }

  return {
    title: `${product.name} - ShopAI`,
    description: product.desc || `Chi tiết sản phẩm ${product.name} tại ShopAI.`,
  };
}

export default async function ProductDetailPage({ params }) {
  const { id } = await params;
  const product = await findProductForMetadata(id);

  // id không khớp sản phẩm nào (vd URL gõ sai/sản phẩm đã bị xoá) -> 404.
  if (!product) notFound();

  return (
    <main className="flex-1 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <ProductDetail id={id} />
      </div>
    </main>
  );
}
