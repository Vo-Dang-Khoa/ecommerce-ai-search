-- ShopAI (ecommerce-ai-search) — Supabase schema
--
-- Cách chạy: Supabase Dashboard > project của bạn > SQL Editor > New query
-- > dán toàn bộ nội dung file này > Run. Chỉ cần chạy 1 lần.
--
-- Sau khi chạy xong, nhớ:
--   1. Vào Project Settings > API, copy "Project URL" và "anon public" key
--   2. Dán vào file .env.local (xem .env.local.example) với tên biến
--      NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY
--   3. Khởi động lại `npm run dev`

-- ============================================================
-- 1. Bảng gian hàng (mỗi user "đăng nhập" giả lập = 1 gian hàng)
-- ============================================================
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  name text not null,
  description text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists shops_owner_email_idx on shops (owner_email);

-- ============================================================
-- 2. Bảng sản phẩm do người bán tự thêm (khác với PRODUCTS demo
--    tĩnh trong src/lib/products.js, vẫn giữ nguyên trong code)
-- ============================================================
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  name text not null,
  category text not null,
  price numeric not null default 0,
  description text not null default '',
  images text[] not null default '{}',
  promotion jsonb,
  created_at timestamptz not null default now()
);

create index if not exists products_shop_id_idx on products (shop_id);

-- ============================================================
-- 3. Row Level Security
-- ============================================================
-- LƯU Ý QUAN TRỌNG: project này chưa dùng Supabase Auth thật — việc
-- "đăng nhập" hiện chỉ là nhập email lưu ở localStorage (xem
-- src/app/providers.js, AuthProvider). Vì vậy không có auth.uid() để
-- policy kiểm tra "ai là chủ gian hàng", nên các policy dưới đây cho
-- phép đọc/ghi công khai qua anon key.
--
-- Điều này CHỈ phù hợp cho đồ án demo. Nếu triển khai thật, bạn cần
-- thêm Supabase Auth (email/password hoặc OAuth) và viết lại policy
-- dựa trên auth.uid() = shops.owner_id để chặn người khác sửa/xoá
-- gian hàng/sản phẩm không phải của họ.

alter table shops enable row level security;
alter table products enable row level security;

drop policy if exists "Public can read shops" on shops;
create policy "Public can read shops" on shops
  for select using (true);

drop policy if exists "Public can insert shops" on shops;
create policy "Public can insert shops" on shops
  for insert with check (true);

drop policy if exists "Public can update shops" on shops;
create policy "Public can update shops" on shops
  for update using (true);

drop policy if exists "Public can read products" on products;
create policy "Public can read products" on products
  for select using (true);

drop policy if exists "Public can insert products" on products;
create policy "Public can insert products" on products
  for insert with check (true);

drop policy if exists "Public can update products" on products;
create policy "Public can update products" on products
  for update using (true);

drop policy if exists "Public can delete products" on products;
create policy "Public can delete products" on products
  for delete using (true);

-- ============================================================
-- 4. Storage bucket lưu ảnh sản phẩm
-- ============================================================
-- Bucket public để ảnh có thể hiển thị trực tiếp trên trang web qua
-- URL công khai (giống cách ProductCard.js đang render <img src=...>).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "Public can upload product images" on storage.objects;
create policy "Public can upload product images" on storage.objects
  for insert with check (bucket_id = 'product-images');

drop policy if exists "Public can update product images" on storage.objects;
create policy "Public can update product images" on storage.objects
  for update using (bucket_id = 'product-images');

drop policy if exists "Public can delete product images" on storage.objects;
create policy "Public can delete product images" on storage.objects
  for delete using (bucket_id = 'product-images');
