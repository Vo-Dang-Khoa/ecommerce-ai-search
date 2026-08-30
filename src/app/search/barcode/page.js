import CodeSearchClient from "./CodeSearchClient";
import BarcodeScannerClient from "./BarcodeScannerClient";

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
          Quét mã hoặc nhập mã để tìm nhanh
        </h1>
        <p className="text-gray-600 mb-8">
          Mỗi sản phẩm trên ShopAI có 1 mã riêng (xem trên trang chi tiết sản phẩm, ví dụ
          &quot;bsn-1&quot;). Quét mã vạch/QR bằng camera, hoặc nhập mã trực tiếp — không cần
          mô tả, không cần AI.
        </p>

        <h2 className="text-sm font-semibold text-gray-900 mb-3 text-left max-w-md mx-auto">
          📷 Quét bằng camera
        </h2>
        <BarcodeScannerClient />

        <h2 className="text-sm font-semibold text-gray-900 mt-10 mb-3 text-left max-w-md mx-auto">
          ⌨️ Hoặc nhập mã thủ công
        </h2>
        <CodeSearchClient />
      </div>
    </main>
  );
}
