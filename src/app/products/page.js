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
        <h1 id="products-top" className="text-3xl font-bold text-gray-900 mb-2 scroll-mt-24">
          Sản phẩm
        </h1>
        <ProductsBrowser category={category} />
      </div>
    </main>
  );
}
