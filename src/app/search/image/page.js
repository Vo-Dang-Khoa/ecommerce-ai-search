import SearchModeComingSoon from "../SearchModeComingSoon";

export const metadata = {
  title: "Tìm kiếm bằng hình ảnh - ShopAI",
};

export default function ImageSearchPage() {
  return (
    <SearchModeComingSoon
      icon="📷"
      title="Tìm kiếm bằng hình ảnh"
      description="Tải lên một tấm ảnh bánh bạn thích, AI sẽ gợi ý sản phẩm tương tự trong cửa hàng."
    />
  );
}
