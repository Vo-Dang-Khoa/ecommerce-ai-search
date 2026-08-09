import Link from "next/link";

export default function SearchModeComingSoon({ icon, title, description }) {
  return (
    <main className="flex-1 bg-white">
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <span className="text-5xl">{icon}</span>
        <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-2">{title}</h1>
        <p className="text-gray-600 mb-4">{description}</p>
        <p className="text-sm text-amber-700 bg-amber-50 inline-block rounded-full px-3 py-1 mb-8">
          Tính năng đang được phát triển — bản demo đồ án môn học
        </p>
        <div>
          <Link
            href="/search"
            className="bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
          >
            Dùng tìm kiếm bằng văn bản
          </Link>
        </div>
      </div>
    </main>
  );
}
