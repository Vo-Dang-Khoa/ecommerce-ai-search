"use client";

import { useEffect, useMemo, useState } from "react";

function sortCategories(list) {
  return [...list].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi")
  );
}

/**
 * Chọn danh mục sản phẩm theo ĐÚNG 2 BƯỚC: trước tiên chọn 1 trong 12
 * "Ngành hàng" (danh mục cha, vd "THỰC PHẨM ĐÃ CHẾ BIẾN & ĐỒ UỐNG",
 * "THỰC PHẨM TƯƠI SỐNG & NGUYÊN LIỆU"... — xem supabase/schema.sql mục 9),
 * SAU ĐÓ mới hiện ô chọn "Danh mục con" bên trong ngành hàng vừa chọn (nếu
 * ngành hàng đó đã có danh mục con) — không dồn chung tất cả danh mục con
 * của cả 12 ngành hàng vào 1 danh sách dài duy nhất.
 *
 * Dùng ở trang đăng sản phẩm mới (/seller/products/new).
 *
 * @param {{
 *   categories: Array<{id: string, parentId: string|null, name: string, sortOrder: number}>,
 *   categoryId: string|null,
 *   onChange: (categoryId: string|null) => void,
 * }} props
 */
export default function CategoryPicker({ categories, categoryId, onChange }) {
  const roots = useMemo(
    () => sortCategories(categories.filter((c) => !c.parentId)),
    [categories]
  );

  // Suy ra ngành hàng/danh mục con ĐANG chọn từ categoryId lúc component
  // vừa mount (vd sau này dùng lại ở trang sửa sản phẩm, categoryId đã có
  // sẵn giá trị) — chỉ tính 1 lần lúc đầu, các lần đổi lựa chọn sau đó do
  // chính người dùng bấm chọn, dùng state rootId/subId bên dưới.
  const [rootId, setRootId] = useState(() => {
    const node = categories.find((c) => c.id === categoryId);
    if (!node) return "";
    return node.parentId || node.id;
  });
  const [subId, setSubId] = useState(() => {
    const node = categories.find((c) => c.id === categoryId);
    return node?.parentId ? node.id : "";
  });

  const subCategories = useMemo(
    () => sortCategories(categories.filter((c) => c.parentId === rootId)),
    [categories, rootId]
  );

  // Báo lên component cha mỗi khi lựa chọn thay đổi — categoryId cuối cùng
  // là danh mục con nếu ngành hàng có danh mục con (BẮT BUỘC chọn xong cả
  // 2 bước mới trả về id, còn dang dở thì trả về null để trang cha chặn
  // submit), ngược lại dùng luôn ngành hàng làm categoryId.
  useEffect(() => {
    const finalId = subCategories.length > 0 ? subId || null : rootId || null;
    onChange(finalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cần chạy lại khi rootId/subId đổi; onChange là hàm mới mỗi lần trang cha render, đưa vào dependency sẽ chạy lại thừa không cần thiết
  }, [rootId, subId, subCategories.length]);

  function handleRootChange(e) {
    setRootId(e.target.value);
    setSubId(""); // đổi ngành hàng -> phải chọn lại danh mục con từ đầu
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-sm text-gray-700 mb-1">Ngành hàng</label>
        <select
          value={rootId}
          onChange={handleRootChange}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        >
          <option value="">-- Chọn ngành hàng --</option>
          {roots.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {rootId && subCategories.length > 0 && (
        <div>
          <label className="block text-sm text-gray-700 mb-1">Danh mục con</label>
          <select
            value={subId}
            onChange={(e) => setSubId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
          >
            <option value="">-- Chọn danh mục con --</option>
            {subCategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {rootId && subCategories.length === 0 && (
        <p className="text-xs text-gray-400">
          Ngành hàng này chưa có danh mục con — sản phẩm sẽ được gắn trực tiếp vào ngành hàng.
        </p>
      )}
    </div>
  );
}
