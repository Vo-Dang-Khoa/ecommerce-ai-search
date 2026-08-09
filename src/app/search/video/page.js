import SearchModeComingSoon from "../SearchModeComingSoon";

export const metadata = {
  title: "Tìm kiếm bằng Video - ShopAI",
};

export default function VideoSearchPage() {
  return (
    <SearchModeComingSoon
      icon="🎥"
      title="Tìm kiếm bằng Video"
      description="Quay hoặc tải lên một video ngắn, hệ thống sẽ phân tích để tìm sản phẩm phù hợp."
    />
  );
}
