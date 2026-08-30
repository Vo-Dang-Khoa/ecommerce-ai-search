// API tìm kiếm sản phẩm bằng HÌNH ẢNH — khách tải lên (hoặc chụp) 1 tấm
// ảnh bánh họ thích, Gemini "nhìn hiểu" hình ảnh (đặc điểm, màu sắc, cách
// trang trí, loại bánh) rồi chọn sản phẩm tương tự nhất trong catalog —
// dùng chung GEMINI_API_KEY miễn phí đã cấu hình, giống hệt cách làm với
// /api/search (văn bản) và /api/search-voice (giọng nói).
import { GoogleGenAI, ApiError } from "@google/genai";
import { NextResponse } from "next/server";
import { PRODUCTS } from "@/lib/products";
import { checkRateLimit, getClientIp } from "@/lib/security";

const GEMINI_MODEL = "gemini-3.1-flash-lite";

// Ảnh chụp điện thoại bình thường (đã qua nén JPEG) thường 1-5MB — giới
// hạn 9MB base64 (~6.5MB file thật) đủ rộng rãi cho việc demo, vẫn đủ chặn
// việc gửi file khổng lồ để lạm dụng/tốn quota Gemini.
const MAX_IMAGE_BASE64_LENGTH = 9_000_000;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MATCH_SCHEMA = {
  type: "object",
  properties: {
    imageDescription: {
      type: "string",
      description:
        "Mô tả ngắn gọn bằng tiếng Việt những gì thấy trong ảnh (loại bánh, màu sắc, trang trí...)",
    },
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "id sản phẩm trong catalog" },
          reason: {
            type: "string",
            description: "Lý do phù hợp với hình ảnh, bằng tiếng Việt, 1 câu ngắn gọn",
          },
        },
        required: ["id", "reason"],
      },
    },
  },
  required: ["imageDescription", "matches"],
};

function buildPrompt() {
  const catalog = PRODUCTS.map(
    (p) => `- id: ${p.id} | ${p.name} | danh mục: ${p.category} | ${p.desc}`
  ).join("\n");

  return `Bạn là trợ lý tìm kiếm sản phẩm cho một tiệm bánh trực tuyến tên ShopAI.
Hình ảnh đính kèm là một tấm ảnh bánh do khách hàng cung cấp — có thể là ảnh họ tự chụp, ảnh
sưu tầm, hoặc ảnh 1 chiếc bánh họ muốn tìm loại tương tự.

Dưới đây là toàn bộ danh mục sản phẩm hiện có:
${catalog}

Hãy:
1. Quan sát hình ảnh, mô tả ngắn gọn bằng tiếng Việt vào trường "imageDescription" (loại bánh,
   màu sắc, cách trang trí, đặc điểm nổi bật).
2. Dựa trên đặc điểm đó, chọn tối đa 6 sản phẩm TRONG DANH MỤC TRÊN có hình dáng/phong cách/loại
   bánh gần giống nhất, xếp theo thứ tự phù hợp giảm dần.
Chỉ chọn id có trong danh mục ở trên — KHÔNG bịa sản phẩm/id không có. Với mỗi sản phẩm, viết một
lý do ngắn gọn giải thích vì sao nó giống với ảnh. Nếu ảnh không phải bánh hoặc không có sản phẩm
nào giống, để "matches" là mảng rỗng nhưng vẫn điền "imageDescription".`;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nội dung yêu cầu không hợp lệ." }, { status: 400 });
  }

  const imageBase64 = typeof body?.image === "string" ? body.image : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType.split(";")[0].trim() : "";

  if (!imageBase64) {
    return NextResponse.json({ error: "Chưa có dữ liệu hình ảnh." }, { status: 400 });
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return NextResponse.json(
      { error: "Ảnh quá lớn, vui lòng chọn ảnh nhỏ hơn (dưới ~6MB)." },
      { status: 400 }
    );
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "Định dạng ảnh không được hỗ trợ (chỉ nhận JPEG, PNG, WEBP, HEIC)." },
      { status: 400 }
    );
  }

  // Giới hạn số lần gọi theo IP — chặn lạm dụng, mỗi lần gọi tốn quota
  // Gemini nhiều hơn tìm kiếm bằng văn bản vì phải xử lý ảnh.
  const clientIp = getClientIp(request);
  const rate = checkRateLimit(`search-image:${clientIp}`, { limit: 10, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Bạn gửi yêu cầu quá nhanh, vui lòng thử lại sau ít phút." },
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
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt() }, { inlineData: { mimeType, data: imageBase64 } }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: MATCH_SCHEMA,
      },
    });

    const parsed = JSON.parse(response.text ?? '{"imageDescription":"","matches":[]}');

    const matches = (parsed.matches ?? [])
      .map((m) => {
        const product = PRODUCTS.find((p) => p.id === m.id);
        return product ? { product, reason: m.reason } : null;
      })
      .filter(Boolean);

    return NextResponse.json({
      imageDescription: parsed.imageDescription || "",
      matches,
    });
  } catch (error) {
    console.error(
      "[api/search-image] Gemini error:",
      error?.name,
      error?.status,
      error?.message
    );

    if (error instanceof ApiError) {
      const status = error.status;
      if (status === 400) {
        return NextResponse.json(
          { error: "Không xử lý được ảnh này, vui lòng thử ảnh khác." },
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
      { error: "Có lỗi không xác định khi tìm kiếm bằng hình ảnh." },
      { status: 500 }
    );
  }
}
