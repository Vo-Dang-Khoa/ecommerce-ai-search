// API kiểm duyệt nội dung sản phẩm bằng AI — gọi TRƯỚC khi cho phép người
// bán đăng sản phẩm công khai (xem src/app/seller/products/new/page.js).
// Cùng cách làm với /api/search: dùng output_config json_schema để buộc AI
// trả về đúng cấu trúc {allowed, reason}, không cho trả lời tự do.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security";

const MODERATION_SCHEMA = {
  type: "object",
  properties: {
    allowed: {
      type: "boolean",
      description: "true nếu sản phẩm được phép đăng bán, false nếu vi phạm quy định",
    },
    reason: {
      type: "string",
      description:
        'Lý do ngắn gọn bằng tiếng Việt — luôn điền, kể cả khi allowed=true (vd "Không phát hiện vi phạm")',
    },
  },
  required: ["allowed", "reason"],
  additionalProperties: false,
};

function buildPrompt({ name, category, desc }) {
  return `Bạn là hệ thống kiểm duyệt nội dung cho sàn thương mại điện tử ShopAI.
Hãy kiểm tra thông tin sản phẩm dưới đây TRƯỚC KHI cho phép đăng bán công khai:
- Tên sản phẩm: "${name}"
- Danh mục: "${category}"
- Mô tả: "${desc}"

Chặn (allowed=false) nếu rơi vào MỘT trong các trường hợp sau:
1. Hàng cấm/hạn chế kinh doanh: vũ khí, chất cấm/ma tuý, hàng giả/nhái thương hiệu, động
   thực vật quý hiếm, thuốc/dược phẩm không rõ nguồn gốc.
2. Có dấu hiệu lừa đảo: cam kết phi thực tế (vd "lãi 500%/ngày"), yêu cầu chuyển khoản/
   cung cấp thông tin cá nhân đáng ngờ, tạo cảm giác khẩn cấp giả tạo bất thường.
3. Nội dung spam, quảng cáo không liên quan, hoặc rác/vô nghĩa không mô tả sản phẩm thật.
4. Ngôn từ thù ghét, phân biệt đối xử, khiêu dâm, hoặc phản cảm.

Nếu KHÔNG vi phạm điều nào ở trên (kể cả các mặt hàng bánh/thực phẩm/đồ dùng thông
thường), hãy trả về allowed=true.
Luôn giải thích ngắn gọn (1 câu, tiếng Việt) trong "reason".`;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nội dung yêu cầu không hợp lệ." }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const desc = typeof body?.desc === "string" ? body.desc.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Thiếu tên sản phẩm để kiểm duyệt." }, { status: 400 });
  }
  if (name.length > 200 || desc.length > 2000) {
    return NextResponse.json({ error: "Tên/mô tả sản phẩm quá dài." }, { status: 400 });
  }

  // Giới hạn số lần gọi theo IP — chặn lạm dụng (spam tạo sản phẩm để dò
  // luật kiểm duyệt, hoặc tốn phí gọi Anthropic). Xem lưu ý về giới hạn của
  // cách làm này trong src/lib/security.js.
  const clientIp = getClientIp(request);
  const rate = checkRateLimit(`moderate:${clientIp}`, { limit: 20, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Gửi yêu cầu kiểm duyệt quá nhanh, vui lòng thử lại sau ít phút." },
      { status: 429 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Chưa cấu hình ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 512,
      output_config: {
        format: { type: "json_schema", schema: MODERATION_SCHEMA },
        effort: "low",
      },
      messages: [{ role: "user", content: buildPrompt({ name, category, desc }) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const parsed = JSON.parse(textBlock?.text ?? '{"allowed":true,"reason":""}');

    return NextResponse.json({
      allowed: parsed.allowed !== false,
      reason: parsed.reason || "",
    });
  } catch (error) {
    // Lỗi gọi AI (hết hạn key, quá tải, mất mạng...) -> trả lỗi rõ ràng để
    // moderateProductContent() (src/lib/security.js) tự FAIL OPEN, không
    // để sự cố của dịch vụ AI chặn luôn tính năng đăng sản phẩm cốt lõi.
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY không hợp lệ hoặc đã hết hạn." },
        { status: 401 }
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Đã vượt giới hạn gọi AI, vui lòng thử lại sau." },
        { status: 429 }
      );
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return NextResponse.json(
        { error: "Không thể kết nối tới dịch vụ AI." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Dịch vụ kiểm duyệt AI đang gặp sự cố." },
      { status: 502 }
    );
  }
}
