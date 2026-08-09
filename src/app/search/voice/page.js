import SearchModeComingSoon from "../SearchModeComingSoon";

export const metadata = {
  title: "Tìm kiếm bằng giọng nói - ShopAI",
};

export default function VoiceSearchPage() {
  return (
    <SearchModeComingSoon
      icon="🎤"
      title="Tìm kiếm bằng giọng nói"
      description="Nói mô tả loại bánh bạn cần, AI sẽ chuyển thành nội dung tìm kiếm giúp bạn."
    />
  );
}
