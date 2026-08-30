import ProductsBrowser from "./ProductsBrowser";

export const metadata = {
  title: "Sản phẩm - ShopAI",
  description: "Danh sách bánh của ShopAI",
};

export default async function ProductsPage({ searchParams }) {
  const { category } = await searchParams;

  return (
    <main className="flex-1 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <ProductsBrowser category={category} />
      </div>
    </main>
  );
}
