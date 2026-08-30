import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Chỉ cảnh báo ở console, không throw để tránh sập toàn bộ app khi build.
  console.warn(
    "[supabaseClient] Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Sao chép .env.local.example thành .env.local, điền thông tin project Supabase " +
      "(Project Settings > API), rồi khởi động lại `npm run dev`."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tên bucket lưu ảnh sản phẩm trong Supabase Storage.
// Phải trùng với id bucket được tạo trong supabase/schema.sql.
export const PRODUCT_IMAGES_BUCKET = "product-images";

// v12: tên bucket lưu video giới thiệu sản phẩm — phải trùng với id bucket
// "product-videos" được tạo trong supabase/schema.sql (mục 5B).
export const PRODUCT_VIDEOS_BUCKET = "product-videos";
