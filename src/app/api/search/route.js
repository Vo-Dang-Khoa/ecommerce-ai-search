import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { PRODUCTS } from "@/lib/products";

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
        additionalProperties: false,
      },
    },
  },
  required: ["matches"],
  additionalProperties: false,
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Chưa cấu hình ANTHROPIC_API_KEY. Hãy tạo file .env.local từ .env.local.example và điền API key, sau đó khởi động lại server.",
      },
      { status: 500 }
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: {
        format: { type: "json_schema", schema: MATCH_SCHEMA },
        effort: "low",
      },
      messages: [{ role: "user", content: buildPrompt(query) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const parsed = JSON.parse(textBlock?.text ?? '{"matches":[]}');

    const matches = (parsed.matches ?? [])
      .map((m) => {
        const product = PRODUCTS.find((p) => p.id === m.id);
        return product ? { product, reason: m.reason } : null;
      })
      .filter(Boolean);

    return NextResponse.json({ matches });
  } catch (error) {
    if (error instanceof Anthropic.BadRequestError) {
      return NextResponse.json(
        { error: "Yêu cầu gửi tới AI không hợp lệ." },
        { status: 400 }
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY không hợp lệ hoặc đã hết hạn." },
        { status: 401 }
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Đã vượt giới hạn gọi AI, vui lòng thử lại sau ít phút." },
        { status: 429 }
      );
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return NextResponse.json(
        { error: "Không thể kết nối tới dịch vụ AI. Kiểm tra mạng và thử lại." },
        { status: 502 }
      );
    }
    if (error instanceof Anthropic.APIError) {
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
