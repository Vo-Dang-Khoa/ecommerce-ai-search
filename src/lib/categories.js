// Helper cho CÂY DANH MỤC ĐA CẤP (Category -> Product Type -> ...), dựa
// trên bảng `categories` (parent_id tự tham chiếu) trong Supabase — xem
// supabase/schema.sql mục 9. Các hàm ở đây thuần dữ liệu (không gọi
// Supabase), dùng chung cho cả ShopProvider (providers.js), Sidebar
// (CategorySidebar.js) và trang danh mục (/danh-muc/[slug]).

/**
 * Dựng cây lồng nhau (mỗi node có thêm mảng `children`) từ danh sách
 * category phẳng. Không giới hạn số cấp — dù dự án hiện chỉ dùng 2 cấp
 * (Danh mục cha - Loại sản phẩm), cấu trúc này vẫn hỗ trợ thêm cấp sâu hơn
 * sau này (vd Loại sản phẩm -> Biến thể) mà không cần đổi hàm.
 *
 * @param {Array<{id:string, parentId:string|null, name:string, sortOrder:number}>} categories
 * @returns {Array} danh sách node gốc, mỗi node có thêm `children: []`
 */
export function buildCategoryTree(categories) {
  const nodeById = new Map(categories.map((c) => [c.id, { ...c, children: [] }]));
  const roots = [];

  for (const node of nodeById.values()) {
    if (node.parentId && nodeById.has(node.parentId)) {
      nodeById.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortRecursive(nodes) {
    nodes.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi")
    );
    nodes.forEach((n) => sortRecursive(n.children));
  }
  sortRecursive(roots);

  return roots;
}

/** Tìm 1 danh mục theo slug (dùng cho URL /danh-muc/[slug]). */
export function findCategoryBySlug(categories, slug) {
  return categories.find((c) => c.slug === slug) || null;
}

/**
 * id của chính danh mục này + TOÀN BỘ danh mục con/cháu bên dưới — dùng để:
 * xem trang 1 danh mục cha vẫn liệt kê được sản phẩm đã gắn ở danh mục con
 * (vd xem "THỰC PHẨM ĐÃ CHẾ BIẾN & ĐỒ UỐNG" vẫn thấy sản phẩm gắn
 * "Bánh sinh nhật" bên dưới).
 */
export function getDescendantCategoryIds(categoryId, categories) {
  const ids = [categoryId];
  const children = categories.filter((c) => c.parentId === categoryId);
  for (const child of children) {
    ids.push(...getDescendantCategoryIds(child.id, categories));
  }
  return ids;
}

/** Đường dẫn (breadcrumb) từ danh mục gốc tới danh mục hiện tại. */
export function getCategoryPath(categoryId, categories) {
  const path = [];
  let current = categories.find((c) => c.id === categoryId) || null;
  while (current) {
    path.unshift(current);
    current = current.parentId
      ? categories.find((c) => c.id === current.parentId) || null
      : null;
  }
  return path;
}

/** true nếu node hoặc bất kỳ node con/cháu nào có slug === activeSlug. */
export function containsActiveSlug(node, activeSlug) {
  if (!activeSlug) return false;
  if (node.slug === activeSlug) return true;
  return node.children.some((child) => containsActiveSlug(child, activeSlug));
}
