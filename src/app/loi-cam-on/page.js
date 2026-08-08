import Link from "next/link";

export const metadata = {
  title: "Lời cảm ơn - ShopAI",
  description: "Lời cảm ơn gửi đến giảng viên hướng dẫn đề tài",
};

export default function LoiCamOnPage() {
  return (
    <main className="flex-1 bg-amber-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-8 py-12">
          <p className="text-center text-amber-700 font-medium mb-2">
            🎓 Đồ án môn học
          </p>
          <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Lời cảm ơn
          </h1>

          <div className="space-y-4 text-gray-700 leading-relaxed">
            <p>Kính gửi Thầy,</p>
            <p>
              Chúng em xin gửi lời cảm ơn chân thành và sâu sắc nhất đến{" "}
              <strong className="text-gray-900">
                Thầy Tiến sĩ Đỗ Minh Tiến
              </strong>{" "}
              đã tận tình hướng dẫn, chỉ bảo và đồng hành cùng chúng em trong
              suốt quá trình thực hiện đề tài này.
            </p>
            <p>
              Nhờ những góp ý quý báu, sự định hướng đúng đắn cùng kiến thức
              chuyên môn mà Thầy đã truyền đạt, chúng em đã có thể hoàn thiện
              đề tài một cách trọn vẹn, từ khâu xây dựng ý tưởng, thiết kế hệ
              thống cho đến triển khai các tính năng tìm kiếm sản phẩm ứng
              dụng AI. Sự kiên nhẫn và tâm huyết của Thầy là nguồn động lực
              to lớn giúp chúng em vượt qua những khó khăn trong quá trình
              học tập và nghiên cứu.
            </p>
            <p>
              Kính chúc Thầy luôn dồi dào sức khỏe, hạnh phúc và tiếp tục gặt
              hái nhiều thành công trong sự nghiệp giảng dạy và nghiên cứu.
            </p>
            <p>Chúng em xin chân thành cảm ơn Thầy!</p>
          </div>

          <p className="text-right text-gray-600 mt-10 italic">
            Nhóm thực hiện đề tài
          </p>

          <div className="flex justify-center mt-10">
            <Link
              href="/"
              className="text-sm bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
            >
              ← Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
