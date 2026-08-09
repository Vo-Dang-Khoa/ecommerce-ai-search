"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QuickLoginForm from "../components/QuickLoginForm";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Vai trò lấy từ URL (?role=seller hay ?role=buyer, truyền từ mục
  // "Người bán" / "Đăng nhập" trong Header.js) — chỉ để hiển thị tiêu đề
  // đúng ngữ cảnh, không giới hạn tài khoản nào được đăng nhập ở đây.
  const role = searchParams.get("role") === "seller" ? "seller" : "buyer";
  const roleLabel = role === "seller" ? "Người bán" : "Người mua";

  function handleLoginSuccess(loggedInRole) {
    router.push(loggedInRole === "seller" ? "/seller" : "/");
  }

  return (
    <main className="flex-1 bg-amber-50">
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-8 py-10">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            {roleLabel} đăng nhập
          </h1>
          <p className="text-sm text-gray-500 text-center mb-8">
            Đăng nhập vào tài khoản {roleLabel} của bạn.
          </p>

          <QuickLoginForm onSuccess={handleLoginSuccess} />

          <p className="text-sm text-gray-500 text-center mt-6">
            Chưa có tài khoản?{" "}
            <Link
              href={`/register?role=${role}`}
              className="text-gray-900 font-medium hover:underline"
            >
              Đăng ký
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex-1 bg-amber-50" />}>
      <LoginPageInner />
    </Suspense>
  );
}
