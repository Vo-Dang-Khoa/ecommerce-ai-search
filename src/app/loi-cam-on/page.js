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
            <p>Kính gửi quý Thầy/Cô,</p>
            <p>
              Để hoàn thành đồ án môn học với đề tài{" "}
              <strong className="text-gray-900">
                "Webapp thương mại điện tử tích hợp camera để tìm kiếm bằng hình
                ảnh, video, mã vạch, mã số, tìm kiếm bằng giọng nói và cá nhân
                hóa gợi ý sản phẩm"
              </strong>{" "}
              , em đã nhận được sự quan tâm, hướng dẫn và tạo điều kiện vô cùng
              quý báu từ quý Thầy/Cô cũng như trực tiếp từ giảng viên hướng dẫn.
            </p>
            <p>
              Trước hết, em xin bày tỏ lòng biết ơn sâu sắc đến{" "}
              <strong className="text-gray-900">
                Thầy Tiến sĩ Đỗ Minh Tiến.
              </strong>{" "}
              Trong suốt quá trình thực hiện đồ án, với khối lượng kiến thức
              chuyên môn sâu rộng và sự tận tâm nhiệt huyết, Thầy đã trực tiếp
              định hướng, dìu dắt và hỗ trợ em vượt qua những khó khăn, thách
              thức về mặt kỹ thuật. Từ việc tích hợp đa dạng các phương thức tìm
              kiếm thông minh bằng thị giác máy tính, xử lý âm thanh, mã vạch,
              cho đến việc xây dựng hệ thống gợi ý sản phẩm cá nhân hóa, mỗi
              buổi trao đổi với Thầy đều mang lại cho em những bài học thực tiễn
              vô cùng giá trị. Những ý kiến đóng góp, nhận xét sắc bén và sự
              khích lệ kịp thời của Thầy không chỉ giúp em hoàn thành sản phẩm
              một cách chỉn chu, đúng tiến độ mà còn bồi dưỡng thêm cho em tư
              duy giải quyết vấn đề kỹ thuật và nền tảng nghiên cứu vững chắc.
            </p>
            <p>
              Dù đã có nhiều nỗ lực trong quá trình nghiên cứu và triển khai,
              song do những giới hạn về mặt thời gian cũng như kinh nghiệm thực
              tế, đồ án chắc chắn không tránh khỏi những thiếu sót nhất định. Em
              rất mong nhận được sự châm chước và những lời nhận xét, góp ý quý
              báu từ Thầy để đề tài ngày càng được hoàn thiện hơn.
            </p>
            <p>
              Cuối cùng, em xin kính chúc Thầy luôn dồi dào sức khỏe, hạnh phúc
              và gặt hái được nhiều thành công hơn nữa trong sự nghiệp trồng
              người cũng như trong các công trình
            </p>
            <p>Em xin trân trọng cảm ơn!</p>
          </div>

          <p className="text-right text-gray-600 mt-10 italic">Võ Đăng Khoa</p>

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
