import CodeSearchClient from "./CodeSearchClient";

export const metadata = {
  title: "Tìm kiếm bằng mã số, mã vạch, QR - ShopAI",
};

export default function BarcodeSearchPage() {
  return (
    <main className="flex-1 bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <span className="text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
          🔲 Tìm kiếm bằng mã số / mã vạch / QR
        </span>
        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">
          Nhập mã sản phẩm để tìm nhanh
        </h1>
        <p className="text-gray-600 mb-8">
          Mỗi sản phẩm trên ShopAI có 1 mã riêng (xem trên trang chi tiết sản phẩm, ví dụ
          &quot;bsn-1&quot;). Nhập đúng mã để tìm ngay, không cần mô tả, không cần AI.
        </p>

        <CodeSearchClient />

        <p className="mt-10 pt-8 border-t border-gray-100 text-sm text-gray-400">
          🔲 Quét mã vạch/QR trực tiếp bằng camera — sắp ra mắt trong bản cập nhật tiếp theo.
        </p>
      </div>
    </main>
  );
}
