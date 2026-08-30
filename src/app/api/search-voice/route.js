// API tìm kiếm sản phẩm bằng GIỌNG NÓI.
//
// Bản đầu tiên dùng Web Speech API của trình duyệt để chuyển giọng nói ->
// văn bản — nhưng API đó CHỈ chạy tốt trên Chrome/Edge, Safari/Firefox
// không hỗ trợ hoặc hỗ trợ rất hạn chế. Bản này đổi cách làm: trình duyệt
// chỉ cần GHI ÂM (dùng MediaRecorder — được hỗ trợ RỘNG RÃI trên mọi trình
// duyệt hiện đại, kể cả Safari/Firefox, máy tính lẫn điện thoại), sau đó
// gửi thẳng file âm thanh lên đây để Gemini (đã hỗ trợ "nghe hiểu" âm
// thanh, giống cách nó "đọc hiểu" văn bản/hình ảnh) vừa nghe hiểu yêu cầu
// vừa chọn luôn sản phẩm phù hợp, gộp làm 1 bước — vẫn dùng chung
// GEMINI_API_KEY miễn phí đã cấu hình, không cần thêm dịch vụ nào khác.
import { GoogleGenAI, ApiError } from "@google/genai";
import { NextResponse } from "next/server";
import { PRODUCTS } from "@/lib/products";
import { checkRateLimit, getClientIp } from "@/lib/security";

const GEMINI_MODEL = "gemini-3.6-flash";

// 1 câu tìm kiếm nói bình thường (vài giây tới ~20 giây) chỉ tốn vài trăm
// KB khi mã hoá base64 — giới hạn 6MB base64 (~4.5MB file thật) đã rất
// rộng rãi, đủ chặn việc gửi file khổng lồ để lạm dụng/tốn quota Gemini.
const MAX_AUDIO_BASE64_LENGTH = 6_000_000;

// Trình duyệt đôi khi báo mimeType hơi khác tên Gemini công bố hỗ trợ (vd
// Safari ghi âm ra "audio/mp4" nhưng Gemini gọi định dạng đó là "audio/m4a")
// -> chuẩn hoá lại trước khi gửi.
const MIME_TYPE_ALIASES = {
  "audio/mp4": "audio/m4a",
  "audio/x-m4a": "audio/m4a",
};
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/wav",
  "audio/mp3",
  "audio/aiff",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/mpeg",
  "audio/m4a",
  "audio/webm",
]);

const MATCH_SCHEMA = {
  type: "object",
  properties: {
    transcript: {
      type: "string",
      description: "Nội dung nghe được khách nói, viết lại chính xác bằng tiếng Việt",
    },
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
  required: ["transcript", "matches"],
};

function buildPrompt() {
  const catalog = PRODUCTS.map(
    (p) => `- id: ${p.id} | ${p.name} | danh mục: ${p.category} | ${p.desc}`
  ).join("\n");

  return `Bạn là trợ lý tìm kiếm sản phẩm cho một tiệm bánh trực tuyến tên ShopAI.
Đoạn âm thanh đính kèm là một khách hàng nói (bằng tiếng Việt) mô tả loại bánh họ muốn tìm.

Dưới đây là toàn bộ danh mục sản phẩm hiện có:
${catalog}

Hãy:
1. Nghe đoạn âm thanh, viết lại chính xác nội dung khách nói vào trường "transcript".
2. Dựa trên nội dung đó, chọn tối đa 6 sản phẩm phù hợp nhất, xếp theo thứ tự phù hợp giảm dần.
Chỉ chọn id có trong danh mục ở trên. Với mỗi sản phẩm, viết một lý do ngắn gọn bằng tiếng Việt.
Nếu không nghe rõ hoặc không có sản phẩm nào phù hợp, để "matches" là mảng rỗng nhưng vẫn điền
"transcript" với nội dung nghe được (để trống nếu hoàn toàn không nghe được gì).`;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nội dung yêu cầu không hợp lệ." }, { status: 400 });
  }

  const audioBase64 = typeof body?.audio === "string" ? body.audio : "";
  let mimeType = typeof body?.mimeType === "string" ? body.mimeType.split(";")[0].trim() : "";
  mimeType = MIME_TYPE_ALIASES[mimeType] || mimeType;

  if (!audioBase64) {
    return NextResponse.json({ error: "Chưa có dữ liệu âm thanh." }, { status: 400 });
  }
  if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
    return NextResponse.json(
      { error: "Đoạn ghi âm quá dài, vui lòng nói ngắn gọn hơn (dưới ~20 giây)." },
      { status: 400 }
    );
  }
  if (!ALLOWED_AUDIO_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "Định dạng âm thanh từ trình duyệt không được hỗ trợ." },
      { status: 400 }
    );
  }

  // Giới hạn số lần gọi theo IP — chặn lạm dụng (mỗi lần gọi tốn quota
  // Gemini nhiều hơn tìm kiếm bằng văn bản vì phải xử lý âm thanh).
  const clientIp = getClientIp(request);
  const rate = checkRateLimit(`search-voice:${clientIp}`, { limit: 10, windowMs: 60_000 });
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
          parts: [{ text: buildPrompt() }, { inlineData: { mimeType, data: audioBase64 } }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: MATCH_SCHEMA,
      },
    });

    const parsed = JSON.parse(response.text ?? '{"transcript":"","matches":[]}');

    const matches = (parsed.matches ?? [])
      .map((m) => {
        const product = PRODUCTS.find((p) => p.id === m.id);
        return product ? { product, reason: m.reason } : null;
      })
      .filter(Boolean);

    return NextResponse.json({ transcript: parsed.transcript || "", matches });
  } catch (error) {
    console.error(
      "[api/search-voice] Gemini error:",
      error?.name,
      error?.status,
      error?.message
    );

    if (error instanceof ApiError) {
      const status = error.status;
      if (status === 400) {
        return NextResponse.json(
          { error: "Không xử lý được đoạn ghi âm này, vui lòng thử ghi âm lại." },
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
      { error: "Có lỗi không xác định khi tìm kiếm bằng giọng nói." },
      { status: 500 }
    );
  }
}
