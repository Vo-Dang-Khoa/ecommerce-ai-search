import Link from "next/link";
import RecommendedForYou from "./components/RecommendedForYou";

const categories = [
  {
    emoji: "🎂",
    name: "Bánh sinh nhật",
    desc: "Thiết kế theo yêu cầu, đủ hình dáng và hương vị",
  },
  {
    emoji: "🍰",
    name: "Bánh kem",
    desc: "Kem tươi mịn, ngọt thanh, trang trí tinh tế",
  },
  {
    emoji: "🧁",
    name: "Cupcake",
    desc: "Xinh xắn, tiện lợi cho mọi bữa tiệc nhỏ",
  },
  {
    emoji: "🥐",
    name: "Bánh mì & Croissant",
    desc: "Vỏ giòn tan, ủ men tự nhiên mỗi sáng",
  },
  {
    emoji: "🍩",
    name: "Donut",
    desc: "Phủ topping đa dạng, mềm xốp từng miếng",
  },
  {
    emoji: "🍪",
    name: "Bánh quy",
    desc: "Giòn rụm, thơm bơ, đóng hộp làm quà tặng",
  },
  {
    emoji: "🥮",
    name: "Bánh Trung thu",
    desc: "Nhân truyền thống và hiện đại, theo mùa",
  },
  {
    emoji: "🍮",
    name: "Bánh su kem",
    desc: "Nhân kem trứng béo ngậy, vỏ bánh nhẹ tan",
  },
];

const features = [
  {
    icon: "🌾",
    title: "Nguyên liệu tươi sạch",
    desc: "Bột, trứng, sữa tuyển chọn mỗi ngày, không chất bảo quản",
  },
  {
    icon: "🚚",
    title: "Giao hàng nhanh trong ngày",
    desc: "Đặt trước 15h, nhận bánh tươi ngay trong hôm nay",
  },
  {
    icon: "🤖",
    title: "Tìm kiếm bằng AI",
    desc: "Mô tả bằng lời, AI gợi ý đúng loại bánh bạn cần",
  },
];

export default function Home() {
  return (
    <main className="flex-1 bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-b from-amber-50 to-white">
        <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center text-center gap-6">
          <span className="text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
            Tiệm bánh trực tuyến #1 với tìm kiếm AI
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 max-w-2xl leading-tight">
            Bánh ngon mỗi ngày,
            <br />
            ngọt ngào từng khoảnh khắc
          </h1>
          <p className="text-lg text-gray-600 max-w-xl">
            Từ bánh sinh nhật, bánh kem cho đến bánh mì mỗi sáng — chọn đúng
            loại bánh bạn thích chỉ trong vài giây nhờ trợ lý tìm kiếm AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-2">
            <Link
              href="/products"
              className="bg-gray-900 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-800 transition-colors"
            >
              Khám phá sản phẩm
            </Link>
            <Link
              href="/search"
              className="border border-gray-300 text-gray-900 px-6 py-3 rounded-md font-medium hover:bg-gray-50 transition-colors"
            >
              Tìm kiếm bằng AI
            </Link>
          </div>
        </div>
      </section>

      {/* Gợi ý dành cho bạn — cá nhân hoá theo lịch sử mua hàng/xem sản
          phẩm (rule-based, không dùng AI — xem src/lib/recommendations.js).
          Đặt ngay sau Hero để bắt mắt trước khi vào phần danh mục chung. */}
      <section className="max-w-7xl mx-auto px-4 pt-16">
        <RecommendedForYou />
      </section>

      {/* Danh mục bánh */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Các loại bánh nổi bật
          </h2>
          <p className="text-gray-600 mt-2">
            Đa dạng lựa chọn cho mọi dịp, mọi sở thích
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={`/products?category=${encodeURIComponent(cat.name)}`}
              className="group border border-gray-200 rounded-xl p-5 flex flex-col items-center text-center gap-2 hover:border-gray-900 hover:shadow-md transition-all"
            >
              <span className="text-4xl">{cat.emoji}</span>
              <h3 className="font-semibold text-gray-900 group-hover:text-black">
                {cat.name}
              </h3>
              <p className="text-sm text-gray-500">{cat.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Banner khuyến mãi */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="bg-gray-900 rounded-2xl px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-white">
          <div>
            <h2 className="text-2xl font-bold">
              Ưu đãi hôm nay: Giảm 20% cho đơn bánh sinh nhật
            </h2>
            <p className="text-gray-300 mt-1">
              Áp dụng khi đặt trước 24 giờ, số lượng có hạn.
            </p>
          </div>
          <Link
            href="/products?category=B%C3%A1nh%20sinh%20nh%E1%BA%ADt"
            className="bg-white text-gray-900 px-6 py-3 rounded-md font-medium hover:bg-gray-100 transition-colors whitespace-nowrap"
          >
            Đặt bánh ngay
          </Link>
        </div>
      </section>

      {/* Vì sao chọn chúng tôi */}
      <section className="bg-amber-50">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-10">
            Vì sao chọn ShopAI
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {features.map((f) => (
              <div
                key={f.title}
                className="text-center flex flex-col items-center gap-2"
              >
                <span className="text-4xl">{f.icon}</span>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-600 max-w-xs">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
