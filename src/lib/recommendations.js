// Gợi ý sản phẩm CÁ NHÂN HOÁ — KHÔNG dùng AI (Gemini), chạy hoàn toàn bằng
// luật (rule-based) dựa trên lịch sử người dùng. Lựa chọn này (thay vì gọi
// Gemini phân tích) vì mục này hiển thị ở trang chủ/trang danh sách sản
// phẩm — những trang được tải RẤT thường xuyên; nếu mỗi lần tải đều gọi
// Gemini sẽ rất dễ vượt giới hạn miễn phí (15 lượt/phút, 500 lượt/ngày) chỉ
// với vài người dùng truy cập cùng lúc. Cách này chạy tức thì, miễn phí
// tuyệt đối, không phụ thuộc dịch vụ ngoài.
//
// 3 tín hiệu dùng để "hiểu" người dùng thích danh mục nào (mạnh -> yếu):
//   1. Lịch sử MUA HÀNG (bảng orders/order_items) — chỉ có khi đã đăng nhập.
//   2. Giỏ hàng hiện tại — đang thật sự cân nhắc mua.
//   3. Lịch sử XEM sản phẩm — lưu ở localStorage của trình duyệt, hoạt động
//      cả với khách chưa đăng nhập.
// Người dùng mới (chưa xem/mua gì) -> dùng phương án dự phòng: sản phẩm mới
// nhất/đang khuyến mãi, để mục gợi ý không bao giờ trống trơn.

const VIEW_HISTORY_KEY = "shopai_view_history_v1";
const MAX_VIEW_HISTORY = 30;

const WEIGHT_PURCHASE = 3;
const WEIGHT_CART = 2;
const WEIGHT_VIEW = 1;

// Đảm bảo sản phẩm cùng danh mục với sản phẩm đang xem (trang chi tiết sản
// phẩm) luôn được ưu tiên lên đầu, bất kể điểm "yêu thích" tính được từ
// lịch sử người dùng cao hay thấp.
const PREFER_CATEGORY_BONUS = 1000;

/**
 * Ghi nhận 1 lượt xem sản phẩm vào lịch sử (localStorage của trình duyệt) —
 * gọi ở trang chi tiết sản phẩm (/san-pham/[id]) mỗi khi xem 1 sản phẩm.
 */
export function recordProductView(product) {
  if (typeof window === "undefined" || !product?.id) return;
  try {
    const history = getViewHistory().filter((h) => h.productId !== product.id);
    history.unshift({
      productId: product.id,
      category: product.category || "",
      viewedAt: Date.now(),
    });
    localStorage.setItem(VIEW_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_VIEW_HISTORY)));
  } catch {
    // localStorage có thể bị chặn (duyệt web ẩn danh, cài đặt trình duyệt) —
    // đây không phải tính năng cốt lõi, bỏ qua lỗi thay vì làm hỏng trang.
  }
}

/** Đọc lịch sử xem sản phẩm đã lưu — mảng rỗng nếu chưa xem gì hoặc có lỗi. */
export function getViewHistory() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VIEW_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function addScore(map, category, amount) {
  if (!category) return;
  map[category] = (map[category] || 0) + amount;
}

// Tính điểm "yêu thích" từng danh mục — giữ RIÊNG điểm theo từng loại tín
// hiệu (mua/giỏ hàng/đã xem) để có thể suy ra LÝ DO gợi ý cụ thể, không chỉ
// 1 con số tổng chung chung.
function buildCategoryScores({ orders, cartItems, viewHistory, allProducts }) {
  const purchaseScore = {};
  const cartScore = {};
  const viewScore = {};
  const productById = new Map(allProducts.map((p) => [p.id, p]));

  for (const order of orders) {
    for (const item of order.items || []) {
      const product = productById.get(item.productId);
      if (product?.category) addScore(purchaseScore, product.category, WEIGHT_PURCHASE);
    }
  }

  for (const item of cartItems) {
    if (item.product?.category) addScore(cartScore, item.product.category, WEIGHT_CART);
  }

  for (const view of viewHistory) {
    if (view.category) addScore(viewScore, view.category, WEIGHT_VIEW);
  }

  const totalScore = {};
  for (const map of [purchaseScore, cartScore, viewScore]) {
    for (const [category, score] of Object.entries(map)) {
      totalScore[category] = (totalScore[category] || 0) + score;
    }
  }

  return { purchaseScore, cartScore, viewScore, totalScore };
}

// Chọn tín hiệu MẠNH NHẤT đóng góp cho 1 danh mục để diễn giải thành 1 câu
// lý do dễ hiểu, hiển thị y như dòng "🤖 lý do" đã có sẵn ở kết quả tìm
// kiếm bằng AI (ProductCard hỗ trợ sẵn prop `reason`).
function reasonForCategory(category, scores, preferCategory) {
  if (preferCategory && category === preferCategory) {
    return `Cùng danh mục "${category}" với sản phẩm bạn đang xem`;
  }
  const p = scores.purchaseScore[category] || 0;
  const c = scores.cartScore[category] || 0;
  const v = scores.viewScore[category] || 0;
  if (p > 0 && p >= c && p >= v) return `Vì bạn từng mua sản phẩm danh mục "${category}"`;
  if (c > 0 && c >= v) return `Vì bạn đang có sản phẩm danh mục "${category}" trong giỏ hàng`;
  if (v > 0) return `Vì bạn đã xem sản phẩm danh mục "${category}"`;
  return null;
}

/**
 * Gợi ý sản phẩm cá nhân hoá — dùng chung cho cả 3 vị trí: trang chủ, trang
 * danh sách sản phẩm (/products), và "Có thể bạn cũng thích" ở trang chi
 * tiết sản phẩm (truyền `preferCategory` = danh mục sản phẩm đang xem).
 *
 * @param {{
 *   allProducts: object[],
 *   orders?: object[],
 *   cartItems?: object[],
 *   viewHistory?: object[],
 *   excludeProductIds?: string[],
 *   preferCategory?: string|null,
 *   limit?: number,
 * }} opts
 * @returns {{product: object, reason: string}[]}
 */
export function getRecommendations({
  allProducts,
  orders = [],
  cartItems = [],
  viewHistory,
  excludeProductIds = [],
  preferCategory = null,
  limit = 8,
}) {
  const history = viewHistory ?? getViewHistory();
  const excluded = new Set(excludeProductIds);
  const candidates = (allProducts || []).filter(
    (p) => !excluded.has(p.id) && p.moderationStatus !== "rejected"
  );

  const scores = buildCategoryScores({ orders, cartItems, viewHistory: history, allProducts });

  const scored = candidates.map((product) => {
    let score = scores.totalScore[product.category] || 0;
    if (preferCategory && product.category === preferCategory) score += PREFER_CATEGORY_BONUS;
    if (product.promotion?.percent > 0) score += 0.5; // đang khuyến mãi -> ưu tiên nhẹ khi đồng điểm
    return { product, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.product.createdAt || 0) - new Date(a.product.createdAt || 0);
  });

  const withSignal = scored.filter((s) => s.score > 0).slice(0, limit);
  const chosenIds = new Set(withSignal.map((s) => s.product.id));

  // Chưa đủ số lượng (khách mới/chưa có lịch sử) -> lấp đầy bằng sản phẩm
  // mới nhất/còn lại, gắn lý do trung tính thay vì để trống mục gợi ý.
  const fallback = [];
  if (withSignal.length < limit) {
    for (const s of scored) {
      if (fallback.length + withSignal.length >= limit) break;
      if (chosenIds.has(s.product.id)) continue;
      fallback.push(s);
    }
  }

  return [...withSignal, ...fallback].map(({ product }) => ({
    product,
    reason:
      reasonForCategory(product.category, scores, preferCategory) ||
      (product.promotion?.percent > 0
        ? "Đang khuyến mãi, có thể bạn sẽ thích"
        : "Sản phẩm mới có thể bạn thích"),
  }));
}
