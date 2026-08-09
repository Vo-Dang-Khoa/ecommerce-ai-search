-- ShopAI (ecommerce-ai-search) — Supabase schema (v7: thêm trạng thái đơn
-- hàng "shipping" (Đơn đang giao) — Người bán bấm "Bắt đầu giao hàng" ở
-- trang /seller (processing -> shipping), Người mua tự xác nhận "Đã nhận
-- được hàng" ở trang /account khi đơn đang shipping (shipping -> completed).
-- Đơn chỉ huỷ được lúc còn "processing" (Đơn chờ xử lý), trước khi giao.
--
-- Lịch sử: v6 cho phép 1 email vừa là tài khoản Người mua vừa là Người bán
-- (cột is_seller/active_role); v5 thêm cột attributes (thuộc tính sản
-- phẩm) + policy Người bán xem đơn hàng chứa sản phẩm của mình; v4 thêm
-- Supabase Auth thật + phân vai trò + số điện thoại/địa chỉ giao hàng +
-- bảng orders/order_items.
--
-- File này AN TOÀN để chạy lại (idempotent). Nếu bạn đã chạy bản v1-v6 trước
-- đó, chỉ cần chạy lại TOÀN BỘ file v7 này thêm 1 lần — nó tự thêm
-- bảng/cột/policy mới, không xoá dữ liệu tài khoản/gian hàng/sản phẩm đã có.
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

-- v6: is_seller — tài khoản này đã từng đăng ký/được cấp vai trò Người bán
-- chưa (khác với cột `role` chỉ ghi vai trò lúc đăng ký ĐẦU TIÊN). Một tài
-- khoản (1 email) có thể vừa mua vừa bán: is_seller = true nghĩa là được
-- phép đăng nhập vào /seller, còn Người mua thì tài khoản nào cũng làm được
-- (không cần cột riêng).
alter table profiles add column if not exists is_seller boolean not null default false;
update profiles set is_seller = true where role = 'seller' and is_seller = false;

-- v6: active_role — vai trò ĐANG đăng nhập hiện tại của tài khoản (chỉ 1
-- trong 2: 'buyer' hoặc 'seller', hoặc null nếu đã đăng xuất khỏi cả 2).
-- Dùng để chặn đăng nhập đồng thời cả 2 vai trò: khi đăng nhập vai trò khác
-- với active_role hiện có, ứng dụng sẽ hỏi xác nhận trước khi ghi đè.
alter table profiles add column if not exists active_role text check (active_role in ('buyer', 'seller'));

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
  insert into public.profiles (id, email, role, is_seller)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'buyer'),
    coalesce(new.raw_user_meta_data ->> 'role', 'buyer') = 'seller'
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

-- v5: thuộc tính sản phẩm (VD: Trọng lượng: 500g, Xuất xứ: Việt Nam...),
-- nhập ở trang chỉnh sửa sản phẩm (/seller/products/[id]). Lưu dạng mảng
-- JSON các cặp { key, value } để linh hoạt, không cần đổi schema mỗi khi
-- thêm loại thuộc tính mới.
alter table products add column if not exists attributes jsonb not null default '[]';

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

-- ============================================================
-- 6. Đơn hàng — tạo ra khi Người mua bấm "Xác nhận đặt hàng" ở /checkout,
--    xem lại ở /account (mục "Người mua" trong header) theo 3 trạng thái:
--    processing (đang xử lý), completed (đã mua/đã nhận hàng), cancelled
--    (đã huỷ). order_items lưu lại tên/ảnh/giá tại THỜI ĐIỂM đặt hàng
--    (snapshot) để lịch sử đơn hàng không đổi kể cả khi sau này người bán
--    sửa/xoá sản phẩm.
-- ============================================================
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'cancelled')),
  payment_method text not null,
  shipping_method text not null,
  shipping_fee numeric not null default 0,
  subtotal numeric not null default 0,
  total numeric not null default 0,
  address text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists orders_buyer_id_idx on orders (buyer_id);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  -- product_id lưu dạng text (không đặt foreign key) vì sản phẩm demo tĩnh
  -- trong src/lib/products.js dùng id dạng chuỗi, không phải uuid như sản
  -- phẩm thật trong bảng products.
  product_id text not null,
  product_name text not null,
  product_image text,
  unit_price numeric not null default 0,
  qty integer not null default 1
);

create index if not exists order_items_order_id_idx on order_items (order_id);

alter table orders enable row level security;
alter table order_items enable row level security;

drop policy if exists "Buyers can read own orders" on orders;
create policy "Buyers can read own orders" on orders
  for select using (auth.uid() = buyer_id);

drop policy if exists "Buyers can insert own orders" on orders;
create policy "Buyers can insert own orders" on orders
  for insert with check (auth.uid() = buyer_id);

drop policy if exists "Buyers can update own orders" on orders;
create policy "Buyers can update own orders" on orders
  for update using (auth.uid() = buyer_id);

drop policy if exists "Buyers can read own order items" on order_items;
create policy "Buyers can read own order items" on order_items
  for select using (
    order_id in (select id from orders where buyer_id = auth.uid())
  );

drop policy if exists "Buyers can insert own order items" on order_items;
create policy "Buyers can insert own order items" on order_items
  for insert with check (
    order_id in (select id from orders where buyer_id = auth.uid())
  );

-- ============================================================
-- 7. Người bán xem đơn hàng của gian hàng mình — trang /seller, mục
--    "Đơn đang đặt" / "Đơn đã giao" / "Đơn đã huỷ". Đây là policy SELECT
--    bổ sung (cộng thêm, không thay thế policy của Người mua ở trên) —
--    Postgres RLS tự động nối các policy SELECT permissive trên cùng 1
--    bảng bằng OR, nên Người mua vẫn xem được đơn của mình, còn Người bán
--    xem được thêm các đơn có chứa sản phẩm của gian hàng mình.
-- ============================================================
drop policy if exists "Sellers can read orders containing their products" on orders;
create policy "Sellers can read orders containing their products" on orders
  for select using (
    id in (
      select order_id from order_items
      where product_id in (
        select id::text from products
        where shop_id in (select id from shops where owner_id = auth.uid())
      )
    )
  );

drop policy if exists "Sellers can read own product order items" on order_items;
create policy "Sellers can read own product order items" on order_items
  for select using (
    product_id in (
      select id::text from products
      where shop_id in (select id from shops where owner_id = auth.uid())
    )
  );

-- ============================================================
-- 8. Trạng thái đơn hàng "shipping" (Đơn đang giao) + cho phép Người bán
--    tự chuyển đơn từ "processing" (chờ xử lý) sang "shipping" (đang giao)
--    ở trang /seller. Ràng buộc check cũ chỉ cho 'processing'/'completed'/
--    'cancelled' nên phải xoá và tạo lại để thêm 'shipping'.
-- ============================================================
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('processing', 'shipping', 'completed', 'cancelled'));

drop policy if exists "Sellers can update orders containing their products" on orders;
create policy "Sellers can update orders containing their products" on orders
  for update using (
    id in (
      select order_id from order_items
      where product_id in (
        select id::text from products
        where shop_id in (select id from shops where owner_id = auth.uid())
      )
    )
  );
