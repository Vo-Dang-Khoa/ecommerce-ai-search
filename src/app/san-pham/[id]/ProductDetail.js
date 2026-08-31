"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, useShop } from "../../providers";
import { getEffectivePrice, getProductImage } from "@/lib/shops";
import { getCategoryPath } from "@/lib/categories";
import { recordProductView } from "@/lib/recommendations";
import RecommendedForYou from "../../components/RecommendedForYou";
import AdSlot from "../../components/AdSlot";

// Trang chi tiết sản phẩm — lấy dữ liệu từ Context (ShopProvider) như phần
// còn lại của app, đầy đủ hơn ProductQuickView (modal "Xem nhanh"): có
// breadcrumb theo cây danh mục, thư viện ảnh (nếu sản phẩm có nhiều ảnh),
// mô tả đầy đủ không rút gọn, và toàn bộ thuộc tính sản phẩm.
export default function ProductDetail({ id }) {
  const router = useRouter();
  const { allProducts, categories, hydrated, loadError } = useShop();
  const { addItem, buyNow } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const product = useMemo(
    () => allProducts.find((p) => p.id === id) || null,
    [allProducts, id]
  );

  const images = product?.images || [];
  const mainImage = images[activeImage] || getProductImage(product);
  const effectivePrice = product ? getEffectivePrice(product) : 0;
  const onSale = product ? effectivePrice < product.price : false;
  const attributes = product?.attributes || [];

  const breadcrumb = useMemo(
    () => (product?.categoryId ? getCategoryPath(product.categoryId, categories) : []),
    [product, categories]
  );

  // Ghi nhận lượt xem để tính gợi ý cá nhân hoá sau này (xem
  // src/lib/recommendations.js) — lưu ở localStorage, hoạt động cả với
  // khách chưa đăng nhập.
  useEffect(() => {
    if (product) recordProductView(product);
  }, [product]);

  function handleAdd() {
    addItem(product.id, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  function handleBuyNow() {
    buyNow(product.id, qty);
    router.push("/checkout");
  }

  if (!hydrated) return null;

  if (loadError) {
    return <p className="text-red-600 text-sm">{loadError}</p>;
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-6">Không tìm thấy sản phẩm này.</p>
        <Link
          href="/products"
          className="bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
        >
          Xem sản phẩm khác
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb — chỉ hiện được cho sản phẩm đã gắn category_id theo
          cây danh mục mới (xem src/lib/categories.js). */}
      <p className="text-xs text-gray-400 mb-6">
        <Link href="/products" className="hover:text-gray-900">
          Sản phẩm
        </Link>
        {breadcrumb.map((c) => (
          <span key={c.id}>
            {" "}
            /{" "}
            <Link href={`/danh-muc/${c.slug}`} className="hover:text-gray-900">
              {c.name}
            </Link>
          </span>
        ))}
        {!breadcrumb.length && (
          <span> / {product.category}</span>
        )}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Ảnh sản phẩm */}
        <div>
          {mainImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URLs/arbitrary URLs
            <img
              src={mainImage}
              alt={product.name}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="w-full h-80 object-cover rounded-xl bg-amber-50"
            />
          ) : (
            <div className="w-full h-80 flex items-center justify-center bg-amber-50 rounded-xl">
              <span className="text-8xl">{product.emoji}</span>
            </div>
          )}
          {images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {images.map((img, i) => (
                <button
                  key={img + i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                    i === activeImage ? "border-gray-900" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URLs/arbitrary URLs */}
                  <img
                    src={img}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thông tin sản phẩm */}
        <div>
          <p className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 w-fit mb-3">
            {product.category}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{product.name}</h1>

          <span className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
            {onSale && (
              <span className="text-base text-gray-400 line-through font-normal">
                {product.price.toLocaleString("vi-VN")}đ
              </span>
            )}
            <span className="text-2xl">{effectivePrice.toLocaleString("vi-VN")}đ</span>
            {onSale && (
              <span className="text-xs font-semibold bg-red-600 text-white rounded-full px-2 py-0.5">
                -{product.promotion.percent}%
              </span>
            )}
          </span>

          {product.desc && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Mô tả sản phẩm</h2>
              <p className="text-sm text-gray-600 whitespace-pre-line">{product.desc}</p>
            </div>
          )}

          {attributes.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Thông tin chi tiết</h2>
              <div className="border border-gray-100 bg-gray-50 rounded-lg p-3 flex flex-col gap-1.5">
                {attributes.map((attr, i) => (
                  <div key={i} className="flex text-sm">
                    <span className="text-gray-500 w-32 shrink-0">{attr.key}</span>
                    <span className="text-gray-900">{attr.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mb-5">
            <span className="text-sm text-gray-700">Số lượng</span>
            <div className="flex items-center border border-gray-300 rounded-md">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-50"
              >
                −
              </button>
              <span className="w-10 text-center text-sm">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleAdd}
              className="text-sm font-medium border border-gray-900 text-gray-900 rounded-md py-3 hover:bg-gray-50 transition-colors"
            >
              {added ? "Đã thêm ✓" : "Thêm vào giỏ"}
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              className="text-sm font-medium bg-amber-600 text-white rounded-md py-3 hover:bg-amber-700 transition-colors"
            >
              Mua ngay
            </button>
          </div>
        </div>
      </div>

      {/* Banner quảng cáo — ưu tiên banner của CHÍNH gian hàng đang bán sản
          phẩm này (preferShopId), rơi về banner gian hàng khác nếu gian
          hàng này chưa tạo banner (xem pickBanner ở src/lib/banners.js).
          AdSlot tự ẩn nếu chưa có banner nào đang bật. */}
      <div className="mt-12">
        <AdSlot preferShopId={product.shopId} />
      </div>

      <div className="mt-16">
        <RecommendedForYou
          title="Có thể bạn cũng thích"
          subtitle=""
          preferCategory={product.category}
          excludeProductIds={[product.id]}
          limit={4}
        />
      </div>
    </div>
  );
}
