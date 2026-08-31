"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/**
 * Link điều hướng dùng cho các nút trên thanh Header (Trang chủ, Sản phẩm,
 * Danh mục, Lời cảm ơn, Người bán, Giỏ hàng, các kiểu tìm kiếm AI...).
 *
 * Xử lý riêng 1 trường hợp `next/link` mặc định BỎ QUA: bấm vào nút điều
 * hướng của CHÍNH trang đang mở (URL đích === URL hiện tại, vd đang ở
 * /products mà bấm lại nút "Sản phẩm") thì Next.js thấy route không đổi nên
 * không làm gì cả — người dùng dễ hiểu lầm là web bị đứng/không phản hồi.
 * Ở đây, gặp đúng trường hợp đó thì chủ động cuộn mượt về đầu trang + gọi
 * `router.refresh()` (tải lại dữ liệu phía server cho route hiện tại), để
 * bấm nút vẫn thấy trang "phản hồi" rõ ràng, giống cảm giác mở lại đúng
 * trang đó — đúng như khi bấm sang trang KHÁC rồi bấm quay lại.
 *
 * @param {{href: string, onNavigate?: () => void, className?: string, children: React.ReactNode}} props
 */
export default function NavLink({ href, onNavigate, className = "", children, ...rest }) {
  const pathname = usePathname();
  const router = useRouter();

  function handleClick() {
    onNavigate?.();

    // So khớp cả query string (vd "/products?category=..." hay
    // "/login?role=buyer") bằng URL thật của trình duyệt — pathname từ
    // usePathname() không kèm query nên chỉ dùng làm phương án dự phòng.
    const currentUrl =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : pathname;

    if (currentUrl === href) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    }
  }

  return (
    <Link href={href} onClick={handleClick} className={className} {...rest}>
      {children}
    </Link>
  );
}
