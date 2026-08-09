"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth, useShop } from "../providers";
import { getEffectivePrice, getProductImage } from "@/lib/shops";

function RegisterShopForm() {
  const { registerShop } = useShop();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (name.trim().length < 3) {
      setError("Tên gian hàng phải có ít nhất 3 ký tự.");
      return;
    }
    setError("");
    registerShop({ name: name.trim(), phone: phone.trim(), description: description.trim() });
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-8 py-10">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Đăng ký gian hàng
        </h1>
        <p className="text-sm text-gray-500 text-center mb-8">
          Mở gian hàng để bắt đầu đăng bán sản phẩm trên ShopAI.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Tên gian hàng
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tiệm bánh của tôi"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Số điện thoại
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Giới thiệu gian hàng
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Chuyên bánh sinh nhật, bánh ngọt theo yêu cầu..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            className="bg-gray-900 text-white py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors mt-2"
          >
            Đăng ký gian hàng
          </button>
        </form>
      </div>
    </div>
  );
}

function ShopInfoCard({ shop }) {
  const { updateShop } = useShop();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(shop.name);
  const [phone, setPhone] = useState(shop.phone);
  const [description, setDescription] = useState(shop.description);

  function handleSave(e) {
    e.preventDefault();
    updateShop({ name: name.trim(), phone: phone.trim(), description: description.trim() });
    setEditing(false);
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="border border-gray-200 rounded-xl p-6 flex flex-col gap-3 mb-8"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900 resize-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800"
          >
            Lưu
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-gray-600 px-4 py-2 hover:text-gray-900"
          >
            Huỷ
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl p-6 flex items-start justify-between mb-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{shop.name}</h2>
        {shop.phone && <p className="text-sm text-gray-500 mt-1">📞 {shop.phone}</p>}
        {shop.description && (
          <p className="text-sm text-gray-600 mt-2">{shop.description}</p>
        )}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md px-3 py-1.5"
      >
        Sửa thông tin
      </button>
    </div>
  );
}

function ProductRow({ product }) {
  const { removeProduct } = useShop();
  const image = getProductImage(product);
  const effectivePrice = getEffectivePrice(product);
  const onSale = effectivePrice < product.price;

  function handleDelete() {
    if (confirm(`Xoá sản phẩm "${product.name}"?`)) {
      removeProduct(product.id);
    }
  }

  return (
    <div className="flex items-center gap-4 border border-gray-200 rounded-xl p-4">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URLs/arbitrary URLs
        <img
          src={image}
          alt={product.name}
          className="w-14 h-14 object-cover rounded-md bg-amber-50"
        />
      ) : (
        <span className="text-3xl w-14 text-center">🧁</span>
      )}
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900">{product.name}</h3>
        <p className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 w-fit mt-1">
          {product.category}
        </p>
      </div>
      <div className="text-right">
        {onSale && (
          <p className="text-xs text-gray-400 line-through">
            {product.price.toLocaleString("vi-VN")}đ
          </p>
        )}
        <p className="font-semibold text-gray-900">
          {effectivePrice.toLocaleString("vi-VN")}đ
        </p>
        {onSale && (
          <p className="text-xs text-red-600">-{product.promotion.percent}% khuyến mãi</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/seller/products/${product.id}`}
          className="text-sm text-center bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800"
        >
          Quản lý
        </Link>
        <button
          onClick={handleDelete}
          className="text-sm text-red-600 hover:text-red-700"
        >
          Xoá
        </button>
      </div>
    </div>
  );
}

function ShopDashboard({ shop }) {
  const { myShopProducts } = useShop();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Kênh người bán</h1>
      <ShopInfoCard shop={shop} />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          Sản phẩm ({myShopProducts.length})
        </h2>
        <Link
          href="/seller/products/new"
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800"
        >
          + Thêm sản phẩm
        </Link>
      </div>

      {myShopProducts.length === 0 ? (
        <p className="text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-xl">
          Gian hàng chưa có sản phẩm nào. Hãy thêm sản phẩm đầu tiên.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {myShopProducts.map((product) => (
            <ProductRow key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SellerPage() {
  const { user, hydrated: authHydrated } = useAuth();
  const { myShop, hydrated: shopHydrated } = useShop();

  if (!authHydrated || !shopHydrated) return null;

  if (!user) {
    return (
      <main className="flex-1 bg-amber-50">
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <p className="text-gray-600 mb-6">
            Bạn cần đăng nhập để đăng ký và quản lý gian hàng.
          </p>
          <Link
            href="/login"
            className="bg-gray-900 text-white px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
          >
            Đăng nhập
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-amber-50">
      {myShop ? <ShopDashboard shop={myShop} /> : <RegisterShopForm />}
    </main>
  );
}
