-- ShopAI (ecommerce-ai-search) — Supabase schema (v3: thêm Supabase Auth thật
-- + phân vai trò Người mua / Người bán, thay cho cơ chế đăng nhập giả lập;
-- + thêm số điện thoại/địa chỉ giao hàng của khách cho trang /checkout).
--
-- File này AN TOÀN để chạy lại (idempotent). Nếu bạn đã chạy bản v1/v2 trước
-- đó, chỉ cần chạy lại TOÀN BỘ file v3 này thêm 1 lần — nó tự thêm bảng/cột/
-- policy mới, không xoá dữ liệu tài khoản/gian hàng/sản phẩm đã có.
--
-- Cách chạy: Supabase Dashboard > project của bạn > SQL Editor > New query
-- > dán toàn bộ nội dung file này > Run.
--
-- Sau khi chạy xong:
--   1. (Khuyến nghị cho đồ án demo) Vào Authentication > Providers > Email,
--      tắt "Confirm email" để đăng ký xong là đăng nhập được ngay, không cần
--      bấm link xác nhận trong hộp thư thật. Nếu để bật, người dùng phải xác
--      nhận email trước khi đăng nhập lần đầu (thực tế hơn nhưng chậm hơn khi demo).
--   2. Copy Project URL + anon/publishable key vào .env.local
--   3. npm install @supabase/supabase-js (nếu chưa cài)
--   4. npm run dev

-- ============================================================
-- 1. Bảng profiles — lưu vai trò (role) của mỗi tài khoản Supabase Auth
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'buyer' check (role in ('buyer', 'seller')),
  created_at timestamptz not null default now()
);

-- v3: thêm số điện thoại + địa chỉ giao hàng của khách (Người mua), dùng ở
-- trang /checkout để hiển thị/lưu lại thông tin liên hệ khi đặt hàng.
alter table profiles add column if not exists phone text not null default '';
alter table profiles add column if not exists address text not null default '';

alter table profiles enable row level security;

drop policy if exists "Users can read own profile" on profiles;
create policy "Users can read own profile" on profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Trigger: mỗi khi có tài khoản mới được tạo trong Supabase Auth (auth.users),
-- tự động tạo 1 dòng profiles tương ứng, lấy role từ metadata gửi kèm lúc gọi
-- supabase.auth.signUp({ options: { data: { role } } }) trong code JS — mặc
-- định 'buyer' nếu không có. Chạy với quyền security definer nên không bị
-- chặn bởi RLS của bảng profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'buyer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. Bảng gian hàng — thêm owner_id (uuid, liên kết auth.users thật).
--    Cột owner_email cũ vẫn giữ lại (không xoá) để không phá dữ liệu nếu
--    bạn đã tạo gian hàng từ bản demo trước; code mới dùng owner_id.
-- ============================================================
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  name text not null,
  description text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);

alter table shops add column if not exists owner_id uuid references auth.users (id) on delete cascade;

create index if not exists shops_owner_email_idx on shops (owner_email);
create index if not exists shops_owner_id_idx on shops (owner_id);

-- ============================================================
-- 3. Bảng sản phẩm (không đổi cấu trúc so với bản v1)
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
-- 4. Row Level Security — thay policy "công khai cho mọi thao tác ghi" ở
--    bản v1 bằng policy dựa trên auth.uid() thật, vì giờ đã có Supabase Auth.
--    Đọc (select) vẫn công khai để khách chưa đăng nhập cũng xem được sản
--    phẩm/gian hàng trên trang web.
-- ============================================================
alter table shops enable row level security;
alter table products enable row level security;

drop policy if exists "Public can read shops" on shops;
create policy "Public can read shops" on shops
  for select using (true);

drop policy if exists "Public can insert shops" on shops;
drop policy if exists "Sellers can insert own shop" on shops;
create policy "Sellers can insert own shop" on shops
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Public can update shops" on shops;
drop policy if exists "Sellers can update own shop" on shops;
create policy "Sellers can update own shop" on shops
  for update using (auth.uid() = owner_id);

drop policy if exists "Public can read products" on products;
create policy "Public can read products" on products
  for select using (true);

drop policy if exists "Public can insert products" on products;
drop policy if exists "Sellers can insert own products" on products;
create policy "Sellers can insert own products" on products
  for insert with check (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

drop policy if exists "Public can update products" on products;
drop policy if exists "Sellers can update own products" on products;
create policy "Sellers can update own products" on products
  for update using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

drop policy if exists "Public can delete products" on products;
drop policy if exists "Sellers can delete own products" on products;
create policy "Sellers can delete own products" on products
  for delete using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

-- ============================================================
-- 5. Storage bucket lưu ảnh sản phẩm — ai cũng xem được ảnh (public,
--    cần thiết để hiển thị lên web), nhưng chỉ người đã đăng nhập mới
--    được tải lên/sửa/xoá ảnh.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "Public can upload product images" on storage.objects;
drop policy if exists "Authenticated can upload product images" on storage.objects;
create policy "Authenticated can upload product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

drop policy if exists "Public can update product images" on storage.objects;
drop policy if exists "Authenticated can update product images" on storage.objects;
create policy "Authenticated can update product images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');

drop policy if exists "Public can delete product images" on storage.objects;
drop policy if exists "Authenticated can delete product images" on storage.objects;
create policy "Authenticated can delete product images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');
