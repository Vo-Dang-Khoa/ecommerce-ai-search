import { GoogleGenAI, ApiError } from "@google/genai";
import { NextResponse } from "next/server";
import { PRODUCTS } from "@/lib/products";
import { checkRateLimit, getClientIp } from "@/lib/security";

// Model miễn phí (free tier, không cần thẻ) — xem chi tiết ở .env.local.example.
const GEMINI_MODEL = "gemini-3.1-flash-lite";

const MATCH_SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "id sản phẩm trong catalog" },
          reason: {
            type: "string",
            description: "Lý do phù hợp, bằng tiếng Việt, 1 câu ngắn gọn",
          },
        },
        required: ["id", "reason"],
      },
    },
  },
  required: ["matches"],
};

function buildPrompt(query) {
  const catalog = PRODUCTS.map(
    (p) => `- id: ${p.id} | ${p.name} | danh mục: ${p.category} | ${p.desc}`
  ).join("\n");

  return `Bạn là trợ lý tìm kiếm sản phẩm cho một tiệm bánh trực tuyến tên ShopAI.
Dưới đây là toàn bộ danh mục sản phẩm hiện có:
${catalog}

Yêu cầu của khách hàng: "${query}"

Hãy chọn tối đa 6 sản phẩm phù hợp nhất với yêu cầu trên, xếp theo thứ tự phù hợp giảm dần.
Chỉ chọn id có trong danh mục ở trên. Với mỗi sản phẩm, viết một lý do ngắn gọn bằng tiếng Việt giải thích vì sao nó phù hợp với yêu cầu.
Nếu không có sản phẩm nào thực sự phù hợp, trả về mảng matches rỗng.`;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Nội dung yêu cầu không hợp lệ." },
      { status: 400 }
    );
  }

  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json(
      { error: "Vui lòng nhập mô tả sản phẩm bạn muốn tìm." },
      { status: 400 }
    );
  }

  // Giới hạn độ dài đầu vào — chặn prompt quá dài (tốn phí gọi Anthropic,
  // hoặc cố nhồi nhét nội dung để "lái" AI đi lệch khỏi vai trò tìm kiếm
  // sản phẩm, kiểu tấn công prompt injection). 300 ký tự đủ rộng cho 1 câu
  // mô tả tìm kiếm bình thường bằng tiếng Việt.
  if (query.length > 300) {
    return NextResponse.json(
      { error: "Mô tả tìm kiếm quá dài (tối đa 300 ký tự)." },
      { status: 400 }
    );
  }

  // Giới hạn số lần gọi theo IP — chặn lạm dụng gọi AI liên tục (spam tốn
  // phí Anthropic). Xem lưu ý về giới hạn của cách làm này (bộ nhớ trong
  // process, không phân tán) trong src/lib/security.js.
  const clientIp = getClientIp(request);
  const rate = checkRateLimit(`search:${clientIp}`, { limit: 15, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Bạn gửi yêu cầu tìm kiếm AI quá nhanh, vui lòng thử lại sau ít phút." },
      { status: 429 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Chưa cấu hình GEMINI_API_KEY. Hãy tạo file .env.local từ .env.local.example và điền API key miễn phí (lấy tại aistudio.google.com/apikey), sau đó khởi động lại server.",
      },
      { status: 500 }
    );
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPrompt(query),
      config: {
        responseMimeType: "application/json",
        responseSchema: MATCH_SCHEMA,
      },
    });

    const parsed = JSON.parse(response.text ?? '{"matches":[]}');

    const matches = (parsed.matches ?? [])
      .map((m) => {
        const product = PRODUCTS.find((p) => p.id === m.id);
        return product ? { product, reason: m.reason } : null;
      })
      .filter(Boolean);

    return NextResponse.json({ matches });
  } catch (error) {
    // Vẫn ghi log lỗi thật ra Vercel Logs để dễ tra cứu sau này (nếu Google
    // lại đổi model/API) — nhưng không lộ chi tiết kỹ thuật ra cho người
    // dùng cuối nữa (đã xác định xong nguyên nhân ban đầu: model cũ bị Google
    // ngừng hỗ trợ, đã đổi sang GEMINI_MODEL mới ở đầu file).
    console.error("[api/search] Gemini error:", error?.name, error?.status, error?.message);

    // SDK Gemini gom lỗi API vào 1 class ApiError duy nhất (khác Anthropic có
    // nhiều class riêng) — phân biệt loại lỗi qua error.status (mã HTTP).
    if (error instanceof ApiError) {
      const status = error.status;
      if (status === 400) {
        return NextResponse.json(
          { error: "Yêu cầu gửi tới AI không hợp lệ." },
          { status: 400 }
        );
      }
      if (status === 401 || status === 403) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY không hợp lệ hoặc chưa được cấp quyền." },
          { status: 401 }
        );
      }
      if (status === 429) {
        return NextResponse.json(
          { error: "Đã vượt giới hạn miễn phí của Gemini, vui lòng thử lại sau ít phút." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Dịch vụ AI đang gặp sự cố, vui lòng thử lại." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Có lỗi không xác định khi tìm kiếm bằng AI." },
      { status: 500 }
    );
  }
}
