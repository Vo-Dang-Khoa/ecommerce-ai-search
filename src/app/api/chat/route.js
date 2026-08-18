// Chatbot AI của ShopAI — kết hợp 2 việc trong 1 khung chat:
//  1. Tư vấn sản phẩm dạng hội thoại (nhiều lượt, có thể hỏi lại khách).
//  2. Trả lời chính sách + tra cứu đơn hàng THẬT của khách đang đăng nhập.
//
// Điểm khác với /api/search: đây là hội thoại nhiều lượt (phải nhận + gửi
// lại toàn bộ lịch sử mỗi lần gọi, vì Claude API không tự nhớ giữa các lần
// gọi), và dùng "tool use" (function calling) để AI có thể YÊU CẦU server
// tra cứu dữ liệu thật (đơn hàng) thay vì tự bịa ra câu trả lời.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PRODUCTS } from "@/lib/products";
import { PAYMENT_METHODS, SHIPPING_METHODS } from "@/lib/orderOptions";
import { checkRateLimit, getClientIp } from "@/lib/security";

const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 500;

const TOOLS = [
  {
    name: "lookup_recent_orders",
    description:
      "Tra cứu các đơn hàng GẦN ĐÂY của khách hàng đang trò chuyện (chỉ xem được đơn của " +
      "chính họ, KHÔNG xem được của người khác). Dùng khi khách hỏi về đơn hàng đã đặt, " +
      "trạng thái giao hàng, lịch sử mua hàng.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Số đơn hàng gần nhất cần lấy (mặc định 5, tối đa 10)",
        },
      },
    },
  },
];

// Tạo client Supabase GẮN SẴN access_token của khách đang chat (nếu có) —
// nhờ vậy policy RLS "auth.uid() = buyer_id" (supabase/schema.sql) tự động
// chỉ trả về đúng đơn hàng của họ. Đây là kiểm soát ở TẦNG DATABASE, không
// phải do code JS tự lọc, nên AI không thể bị "lừa" để xem đơn của người
// khác dù prompt có bị chèn nội dung độc hại.
function createScopedSupabaseClient(accessToken) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(
    url,
    anonKey,
    accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : undefined
  );
}

async function runLookupRecentOrders(scopedClient, args) {
  const limit = Math.min(Math.max(Number(args?.limit) || 5, 1), 10);
  const { data, error } = await scopedClient
    .from("orders")
    .select("id, status, total, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return { orders: [], note: "Không tra cứu được — khách có thể chưa đăng nhập." };
  }
  if (data.length === 0) {
    return { orders: [], note: "Khách chưa có đơn hàng nào, hoặc chưa đăng nhập." };
  }
  return {
    orders: data.map((o) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      created_at: o.created_at,
    })),
  };
}

function buildCatalogText() {
  return PRODUCTS.map(
    (p) =>
      `- id: ${p.id} | ${p.name} | danh mục: ${p.category} | ${p.price.toLocaleString("vi-VN")}đ | ${p.desc}`
  ).join("\n");
}

function buildSystemPrompt() {
  const payments = PAYMENT_METHODS.map((m) => `- ${m.label}: ${m.desc}`).join("\n");
  const shippings = SHIPPING_METHODS.map(
    (m) => `- ${m.label}: ${m.desc} (phí ${m.fee.toLocaleString("vi-VN")}đ)`
  ).join("\n");

  return `Bạn là trợ lý AI của ShopAI — tiệm bánh trực tuyến. Trả lời NGẮN GỌN, thân thiện, lịch
sự, bằng tiếng Việt.

Bạn có thể:
1. Tư vấn/gợi ý sản phẩm dựa trên catalog dưới đây — có thể hỏi lại khách (vd sở thích, ngân
   sách) trước khi gợi ý nếu câu hỏi chưa đủ rõ. Khi gợi ý 1 sản phẩm cụ thể, LUÔN viết theo
   cú pháp: [Tên sản phẩm](product:id) — ví dụ [Bánh sinh nhật Chocolate Fudge](product:bsn-1).
   CHỈ dùng id có thật trong catalog bên dưới, KHÔNG tự bịa sản phẩm/id không có.
2. Trả lời câu hỏi về chính sách thanh toán/giao hàng dựa theo thông tin dưới đây.
3. Gọi công cụ lookup_recent_orders khi khách hỏi về đơn hàng/lịch sử mua hàng của họ.

Catalog sản phẩm:
${buildCatalogText()}

Phương thức thanh toán:
${payments}

Phương thức giao hàng:
${shippings}

Nếu công cụ lookup_recent_orders báo khách chưa đăng nhập/chưa có đơn hàng, hãy nhắc khách đăng
nhập (nút "Đăng nhập" góc phải trang) rồi hỏi lại, đừng bịa ra đơn hàng không có thật. Không trả
lời về chủ đề ngoài phạm vi ShopAI (sản phẩm bánh, đơn hàng, chính sách cửa hàng).`;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nội dung yêu cầu không hợp lệ." }, { status: 400 });
  }

  const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken : null;

  // Chuẩn hoá + giới hạn lịch sử hội thoại gửi lên — chặn lạm dụng (gửi
  // lịch sử khổng lồ để tốn phí Anthropic), loại tin nhắn rỗng/vai trò lạ.
  const messages = rawMessages
    .filter(
      (m) =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string" &&
        m.content.trim()
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_LENGTH) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Vui lòng nhập câu hỏi." }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const rate = checkRateLimit(`chat:${clientIp}`, { limit: 20, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Bạn gửi tin nhắn quá nhanh, vui lòng thử lại sau ít phút." },
      { status: 429 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Chưa cấu hình ANTHROPIC_API_KEY." }, { status: 500 });
  }

  const client = new Anthropic();
  const scopedSupabase = createScopedSupabaseClient(accessToken);
  const system = buildSystemPrompt();

  try {
    let response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      system,
      tools: TOOLS,
      messages,
    });

    // AI muốn gọi công cụ (tra cứu đơn hàng) -> server THỰC SỰ chạy công cụ
    // đó (qua scoped client ở trên, chỉ thấy đơn của đúng khách đang chat),
    // gửi kết quả THẬT về lại cho AI để nó soạn câu trả lời cuối cùng.
    if (response.stop_reason === "tool_use") {
      const toolUseBlock = response.content.find((b) => b.type === "tool_use");
      let toolResult = { error: "Công cụ không xác định." };

      if (toolUseBlock?.name === "lookup_recent_orders") {
        toolResult = await runLookupRecentOrders(scopedSupabase, toolUseBlock.input);
      }

      response = await client.messages.create({
        model: "claude-opus-5",
        max_tokens: 1024,
        system,
        tools: TOOLS,
        messages: [
          ...messages,
          { role: "assistant", content: response.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUseBlock.id,
                content: JSON.stringify(toolResult),
              },
            ],
          },
        ],
      });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    const reply = textBlock?.text?.trim() || "Xin lỗi, mình chưa trả lời được câu này.";

    return NextResponse.json({ reply });
  } catch (error) {
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
        { error: "Không thể kết nối tới dịch vụ AI." },
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
      { error: "Có lỗi không xác định khi trò chuyện với AI." },
      { status: 500 }
    );
  }
}
