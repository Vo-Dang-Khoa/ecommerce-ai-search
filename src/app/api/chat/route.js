// Chatbot AI của ShopAI — kết hợp 2 việc trong 1 khung chat:
//  1. Tư vấn sản phẩm dạng hội thoại (nhiều lượt, có thể hỏi lại khách).
//  2. Trả lời chính sách + tra cứu đơn hàng THẬT của khách đang đăng nhập.
//
// Điểm khác với /api/search: đây là hội thoại nhiều lượt (phải nhận + gửi
// lại toàn bộ lịch sử mỗi lần gọi, vì Gemini API không tự nhớ giữa các lần
// gọi), và dùng "function calling" để AI có thể YÊU CẦU server tra cứu dữ
// liệu thật (đơn hàng) thay vì tự bịa ra câu trả lời.
import { GoogleGenAI, ApiError } from "@google/genai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PRODUCTS } from "@/lib/products";
import { PAYMENT_METHODS, SHIPPING_METHODS } from "@/lib/orderOptions";
import { checkRateLimit, getClientIp } from "@/lib/security";

// Model miễn phí (free tier, không cần thẻ) — xem chi tiết ở .env.local.example.
const GEMINI_MODEL = "gemini-3.6-flash";

const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 500;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "lookup_recent_orders",
        description:
          "Tra cứu các đơn hàng GẦN ĐÂY của khách hàng đang trò chuyện (chỉ xem được đơn của " +
          "chính họ, KHÔNG xem được của người khác). Dùng khi khách hỏi về đơn hàng đã đặt, " +
          "trạng thái giao hàng, lịch sử mua hàng.",
        parametersJsonSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Số đơn hàng gần nhất cần lấy (mặc định 5, tối đa 10)",
            },
          },
        },
      },
    ],
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

// Nếu vòng gọi AI thứ 2 (gửi kết quả tool về để AI soạn câu trả lời cuối)
// gặp sự cố vì bất kỳ lý do gì, vẫn trả lời khách bằng DỮ LIỆU THẬT đã tra
// được — không để lỗi kỹ thuật biến thành "im lặng"/báo lỗi cho khách.
function summarizeOrdersAsText(toolResult) {
  if (!toolResult.orders || toolResult.orders.length === 0) {
    return (
      toolResult.note ||
      "Bạn chưa có đơn hàng nào, hoặc chưa đăng nhập — hãy đăng nhập rồi hỏi lại nhé."
    );
  }
  const lines = toolResult.orders.map(
    (o) =>
      `- Đơn #${String(o.id).slice(0, 8)}: trạng thái "${o.status}", tổng ${Number(
        o.total
      ).toLocaleString("vi-VN")}đ, đặt ngày ${new Date(o.created_at).toLocaleDateString(
        "vi-VN"
      )}`
  );
  return `Đây là các đơn hàng gần đây của bạn:\n${lines.join("\n")}`;
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

// Gemini API chỉ dùng 2 role trong "contents": "user" và "model" (khác
// Anthropic dùng "assistant") — đổi role tin nhắn cũ sang đúng quy ước.
function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
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
  // lịch sử khổng lồ để tốn quota Gemini), loại tin nhắn rỗng/vai trò lạ.
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

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY." }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const scopedSupabase = createScopedSupabaseClient(accessToken);
  const systemInstruction = buildSystemPrompt();
  const contents = toGeminiContents(messages);

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: { systemInstruction, tools: TOOLS },
    });

    const functionCall = response.functionCalls?.[0];

    // AI muốn gọi công cụ (tra cứu đơn hàng) -> server THỰC SỰ chạy công cụ
    // đó (qua scoped client ở trên, chỉ thấy đơn của đúng khách đang chat).
    if (functionCall?.name === "lookup_recent_orders") {
      const toolResult = await runLookupRecentOrders(scopedSupabase, functionCall.args);

      try {
        // Gửi kết quả THẬT về lại cho AI để nó soạn câu trả lời cuối cùng
        // bằng ngôn ngữ tự nhiên.
        const followUp = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            ...contents,
            {
              role: "model",
              parts: [
                { functionCall: { name: "lookup_recent_orders", args: functionCall.args || {} } },
              ],
            },
            {
              role: "user",
              parts: [
                { functionResponse: { name: "lookup_recent_orders", response: toolResult } },
              ],
            },
          ],
          config: { systemInstruction, tools: TOOLS },
        });

        const reply = followUp.text?.trim() || summarizeOrdersAsText(toolResult);
        return NextResponse.json({ reply });
      } catch {
        // Vòng gọi thứ 2 lỗi (vd sự cố tạm thời) -> vẫn trả lời khách bằng
        // dữ liệu đơn hàng THẬT đã tra được, không để khách nhận lỗi trống.
        return NextResponse.json({ reply: summarizeOrdersAsText(toolResult) });
      }
    }

    const reply = response.text?.trim() || "Xin lỗi, mình chưa trả lời được câu này.";
    return NextResponse.json({ reply });
  } catch (error) {
    // Vẫn ghi log lỗi thật ra Vercel Logs để dễ tra cứu sau này (nếu Google
    // lại đổi model/API) — nhưng không lộ chi tiết kỹ thuật ra cho người
    // dùng cuối nữa (đã xác định xong nguyên nhân ban đầu: model cũ bị Google
    // ngừng hỗ trợ, đã đổi sang GEMINI_MODEL mới ở đầu file).
    console.error("[api/chat] Gemini error:", error?.name, error?.status, error?.message);

    // SDK Gemini gom lỗi API vào 1 class ApiError duy nhất (khác Anthropic có
    // nhiều class riêng) — phân biệt loại lỗi qua error.status (mã HTTP).
    if (error instanceof ApiError) {
      const status = error.status;
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
      { error: "Có lỗi không xác định khi trò chuyện với AI." },
      { status: 500 }
    );
  }
}
