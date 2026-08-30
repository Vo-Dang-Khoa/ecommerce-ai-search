"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "../components/ProductCard";

const SUGGESTIONS = [
  "Bánh sinh nhật ngọt nhẹ cho tiệc nhỏ 5 người",
  "Món ăn sáng nhanh, giòn, thơm bơ",
  "Bánh làm quà tặng dịp Trung thu",
  "Bánh ít ngọt, hợp người ăn kiêng đường",
];

function SearchPageInner() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(urlQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  async function runSearch(q) {
    if (!q.trim()) return;

    setLoading(true);
    setError("");
    setResults(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Có lỗi xảy ra, vui lòng thử lại.");
        return;
      }

      setResults(data.matches);
    } catch {
      setError("Không thể kết nối tới máy chủ. Kiểm tra mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  }

  // Chạy lại tìm kiếm mỗi khi tham số ?q= trên URL thay đổi — không chỉ lúc
  // tải trang lần đầu. Trước đây effect này có dependency rỗng ([]) nên CHỈ
  // chạy 1 lần lúc mount: nếu người dùng đang ở sẵn trang /search rồi gõ từ
  // khoá MỚI vào ô tìm kiếm trên Header và bấm biểu tượng kính lúp, Next.js
  // điều hướng sang cùng route /search (chỉ đổi query string) nên trang
  // KHÔNG bị mount lại — effect không chạy lại, coi như bấm kính lúp "không
  // có tác dụng gì". Đổi dependency thành `urlQuery` để effect chạy lại mỗi
  // khi giá trị này đổi, dù là lần đầu vào trang hay điều hướng lại từ
  // Header trong lúc đang ở ngay trang này.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ lại ô nhập với từ khoá mới trên URL (đến từ ô tìm kiếm trên Header)
    setQuery(urlQuery);
    if (urlQuery) runSearch(urlQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cần chạy lại khi urlQuery đổi, không phải mỗi khi state `query` cục bộ đổi (người dùng gõ trong ô mô tả của chính trang này)
  }, [urlQuery]);

  function handleSearch(e) {
    e?.preventDefault();
    runSearch(query);
  }

  return (
    <main className="flex-1 bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <span className="text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
            🤖 Tìm kiếm bằng AI
          </span>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">
            Mô tả bánh bạn cần, AI sẽ gợi ý giúp bạn
          </h1>
          <p className="text-gray-600 mt-2">
            Ví dụ: &quot;bánh sinh nhật ngọt nhẹ cho tiệc nhỏ&quot; hoặc
            &quot;quà tặng dịp Trung thu&quot;
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col gap-3 mb-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            placeholder="Mô tả nhu cầu của bạn..."
            className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm focus:outline-none focus:border-gray-900 resize-none"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="self-end bg-gray-900 text-white px-6 py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Đang tìm..." : "Tìm kiếm bằng AI"}
          </button>
        </form>

        <div className="flex flex-wrap gap-2 mb-10">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuery(s)}
              className="text-xs text-gray-600 border border-gray-200 rounded-full px-3 py-1 hover:border-gray-900 hover:text-gray-900"
            >
              {s}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-8">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-center text-gray-500">
            AI đang phân tích yêu cầu của bạn...
          </p>
        )}

        {results && results.length === 0 && !loading && (
          <p className="text-center text-gray-500">
            Không tìm thấy sản phẩm phù hợp. Hãy thử mô tả khác.
          </p>
        )}

        {results && results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.map(({ product, reason }) => (
              <ProductCard key={product.id} product={product} reason={reason} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<main className="flex-1 bg-white" />}>
      <SearchPageInner />
    </Suspense>
  );
}
