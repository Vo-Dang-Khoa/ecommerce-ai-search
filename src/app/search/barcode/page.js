import SearchModeComingSoon from "../SearchModeComingSoon";

export const metadata = {
  title: "Tìm kiếm bằng mã vạch, QR - ShopAI",
};

export default function BarcodeSearchPage() {
  return (
    <SearchModeComingSoon
      icon="🔲"
      title="Tìm kiếm bằng mã vạch, QR"
      description="Quét mã vạch hoặc mã QR trên bao bì để tìm nhanh sản phẩm tương ứng."
    />
  );
}
