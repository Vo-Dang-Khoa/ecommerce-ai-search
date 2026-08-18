-- ShopAI (ecommerce-ai-search) — Supabase schema (v11: thêm cột lưu vết
-- kiểm duyệt nội dung sản phẩm bằng AI — products.moderation_status/
-- moderation_reason, xem mục 3 gần cuối file + /api/moderate-product).
--
-- Lịch sử: v10 sắp xếp lại vị trí danh mục cha "THUỐC & SỨC KHỎE" (giữa
-- "THỰC PHẨM TƯƠI SỐNG & NGUYÊN LIỆU" và "THỜI TRANG & PHỤ KIỆN"); v9 thêm
-- danh mục cha "THUỐC & SỨC KHỎE"; v8 cấu trúc lại Danh mục (Taxonomy) —
-- thêm bảng `categories` (cây danh mục đa cấp, tự tham chiếu qua
-- parent_id: Danh mục cha -> Loại sản phẩm -> ...), bảng
-- `category_attributes` (khai báo thuộc tính có thể LỌC theo từng danh mục,
-- phục vụ bộ lọc động mà KHÔNG cần đổi cấu trúc bảng products), cột
-- `products.category_id` (liên kết sản phẩm với cây danh mục mới, giữ
-- nguyên cột `products.category` cũ dạng text — KHÔNG xoá), và mở rộng
-- `profiles.role` để có thêm vai trò 'admin'; v7 thêm trạng thái đơn hàng
-- "shipping" (Đơn đang giao); v6 cho phép 1 email vừa là tài khoản Người
-- mua vừa là Người bán (cột is_seller/active_role); v5 thêm cột attributes
-- (thuộc tính sản phẩm) + policy Người bán xem đơn hàng chứa sản phẩm của
-- mình; v4 thêm Supabase Auth thật + phân vai trò + số điện thoại/địa chỉ
-- giao hàng + bảng orders/order_items.
--
-- File này AN TOÀN để chạy lại (idempotent). Nếu bạn đã chạy bản v1-v10 trước
-- đó, chỉ cần chạy lại TOÀN BỘ file v11 này thêm 1 lần — nó tự thêm/sửa
-- bảng/cột/policy/danh mục, không xoá dữ liệu tài khoản/gian hàng/sản
-- phẩm/danh mục đã có.
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

-- v8: thêm vai trò 'admin' (quản trị danh mục/toàn hệ thống — xem Bước 3 ở
-- lượt tiếp theo: Dashboard Admin + middleware RBAC). Ràng buộc check cũ chỉ
-- cho 'buyer'/'seller' nên phải xoá và tạo lại để thêm 'admin', theo đúng
-- cách đã làm với orders_status_check ở mục 8 bên dưới.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('buyer', 'seller', 'admin'));

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
-- v8: bảng `categories` — CÂY DANH MỤC ĐA CẤP, tự tham chiếu qua parent_id
-- (Danh mục cha -> Loại sản phẩm -> ... không giới hạn số cấp). Tạo TRƯỚC
-- bảng products vì products.category_id (bên dưới) tham chiếu tới đây.
-- Dữ liệu 11 danh mục cha + danh mục con cho ngành bánh (khớp với
-- src/lib/products.js CATEGORIES cũ) được INSERT ở mục 9 cuối file, SAU khi
-- bảng products đã tồn tại (để chạy được câu lệnh backfill category_id).
-- ============================================================
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  -- slug: dùng làm URL SEO-friendly /danh-muc/[slug], vd "banh-sinh-nhat".
  slug text not null unique,
  name text not null,
  -- parent_id null = danh mục cấp cao nhất (1 trong 11 danh mục cha).
  parent_id uuid references categories (id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists categories_parent_id_idx on categories (parent_id);

-- Thuộc tính CÓ THỂ LỌC theo từng danh mục (VD: danh mục "Bánh sinh nhật"
-- có thể lọc theo "Trọng lượng"). Đây là bảng SIÊU DỮ LIỆU MÔ TẢ bộ lọc,
-- HOÀN TOÀN TÁCH RỜI khỏi products.attributes (mảng {key, value} tự do đã
-- có sẵn từ v5) — nhờ vậy thêm/bớt thuộc tính lọc cho 1 danh mục KHÔNG cần
-- đổi cấu trúc bảng products hay bảng categories, đúng yêu cầu "bộ lọc động
-- dựa trên Attributes mà không làm thay đổi cấu trúc Categories".
create table if not exists category_attributes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  -- key phải khớp với attr.key trong products.attributes (jsonb) thì bộ lọc
  -- mới đối chiếu được — xem ProductQuickView/[id] page nhập attributes.
  key text not null,
  label text not null,
  input_type text not null default 'text' check (input_type in ('text', 'number', 'select')),
  -- Danh sách lựa chọn khi input_type = 'select' (vd: ["500g","1kg","1.5kg"]).
  options text[],
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  -- 1 danh mục không khai báo trùng 2 lần cùng 1 key thuộc tính lọc — cũng
  -- là "conflict target" để câu lệnh seed bên dưới chạy lại được nhiều lần.
  unique (category_id, key)
);

create index if not exists category_attributes_category_id_idx on category_attributes (category_id);

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

-- v8: category_id — liên kết sản phẩm với cây danh mục MỚI (bảng
-- `categories`, xem mục 9 bên dưới). Cột `category` (text) cũ VẪN GIỮ
-- NGUYÊN, không xoá, không đổi kiểu — tránh phá dữ liệu/luồng cũ (trang
-- /products?category=... vẫn lọc theo cột text này). `category_id` là cột
-- BỔ SUNG, dùng cho trang danh mục mới (/danh-muc/[slug]) và bộ lọc động.
-- on delete set null: xoá 1 danh mục KHÔNG xoá sản phẩm, chỉ gỡ liên kết.
alter table products add column if not exists category_id uuid
  references categories (id) on delete set null;

create index if not exists products_category_id_idx on products (category_id);

-- v11: lưu vết kết quả kiểm duyệt nội dung bằng AI (xem
-- /api/moderate-product + src/lib/security.js). Ở bản hiện tại, việc kiểm
-- duyệt chạy ĐỒNG BỘ ngay lúc đăng sản phẩm (trang /seller/products/new) —
-- sản phẩm bị AI từ chối sẽ KHÔNG được insert vào bảng này, nên mọi dòng
-- hiện có đều mang moderation_status = 'approved'. 2 cột này là nền tảng
-- sẵn cho luồng duyệt bất đồng bộ/hàng chờ Admin duyệt sau này (lượt kế
-- tiếp), không ảnh hưởng gì tới dữ liệu/luồng đang chạy.
alter table products add column if not exists moderation_status text not null default 'approved'
  check (moderation_status in ('approved', 'rejected'));
alter table products add column if not exists moderation_reason text not null default '';

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

-- ============================================================
-- 9. v8 — RLS cho categories/category_attributes + seed dữ liệu 11 danh mục
--    cha + danh mục con ngành bánh (khớp CATEGORIES cũ trong
--    src/lib/products.js) + backfill products.category_id từ cột category
--    (text) cũ. Chạy SAU section 3 (bảng products đã tồn tại).
-- ============================================================
alter table categories enable row level security;
alter table category_attributes enable row level security;

-- Đọc công khai — khách chưa đăng nhập vẫn xem được cây danh mục/bộ lọc
-- trên web. CHƯA thêm policy insert/update/delete ở bản v8 này: Dashboard
-- Admin + middleware RBAC (kiểm tra profiles.role = 'admin') sẽ làm ở lượt
-- kế tiếp — hiện tại chỉ sửa được qua Supabase Dashboard > Table Editor
-- (dùng service_role, không bị RLS chặn), CHƯA sửa được từ giao diện web.
drop policy if exists "Public can read categories" on categories;
create policy "Public can read categories" on categories
  for select using (true);

drop policy if exists "Public can read category attributes" on category_attributes;
create policy "Public can read category attributes" on category_attributes
  for select using (true);

-- 12 danh mục cha — 11 danh mục gốc theo đúng thứ tự đề bài (v8) + "THUỐC &
-- SỨC KHỎE" (v9, chèn giữa "THỰC PHẨM TƯƠI SỐNG & NGUYÊN LIỆU" và "THỜI
-- TRANG & PHỤ KIỆN" theo yêu cầu v10). sort_order dùng để sắp xếp Sidebar.
-- on conflict (slug) do nothing: nếu bạn đã chạy bản v8 trước đó, 11 danh
-- mục cũ SẼ KHÔNG bị đổi/nhân đôi — chỉ riêng dòng "THUỐC & SỨC KHỎE" (slug
-- mới, chưa từng có) được thêm vào. Vị trí (sort_order) của các dòng ĐÃ TỒN
-- TẠI từ trước được sửa riêng bằng các câu UPDATE bên dưới, vì INSERT ...
-- on conflict do nothing KHÔNG cập nhật được dòng đã có sẵn.
insert into categories (slug, name, parent_id, sort_order) values
  ('thuc-pham-che-bien-do-uong', 'THỰC PHẨM ĐÃ CHẾ BIẾN & ĐỒ UỐNG', null, 1),
  ('thuc-pham-tuoi-song-nguyen-lieu', 'THỰC PHẨM TƯƠI SỐNG & NGUYÊN LIỆU', null, 2),
  ('thuoc-suc-khoe', 'THUỐC & SỨC KHỎE', null, 3),
  ('thoi-trang-phu-kien', 'THỜI TRANG & PHỤ KIỆN', null, 4),
  ('thiet-bi-dien-dien-tu', 'THIẾT BỊ ĐIỆN & ĐIỆN TỬ', null, 5),
  ('my-pham-cham-soc-ca-nhan', 'MỸ PHẨM & CHĂM SÓC CÁ NHÂN', null, 6),
  ('noi-that-van-phong-pham', 'NỘI THẤT & VĂN PHÒNG PHẨM', null, 7),
  ('xay-dung-thiet-ke', 'XÂY DỰNG & THIẾT KẾ', null, 8),
  ('dich-vu-sua-chua', 'DỊCH VỤ & SỬA CHỮA', null, 9),
  ('du-lich-da-ngoai', 'DU LỊCH & DÃ NGOẠI', null, 10),
  ('sach-do-dung-hoc-tap', 'SÁCH & ĐỒ DÙNG HỌC TẬP', null, 11),
  ('nganh-hang-khac', 'NGÀNH HÀNG KHÁC', null, 12)
on conflict (slug) do nothing;

-- v10: đảm bảo đúng thứ tự trên cho CẢ những ai đã chạy bản v9 trước đó
-- (khi "THUỐC & SỨC KHỎE" từng được thêm ở cuối, sort_order = 12). Dùng
-- UPDATE theo slug — an toàn chạy lại nhiều lần (ghi đè cùng 1 giá trị).
update categories set sort_order = 1 where slug = 'thuc-pham-che-bien-do-uong';
update categories set sort_order = 2 where slug = 'thuc-pham-tuoi-song-nguyen-lieu';
update categories set sort_order = 3 where slug = 'thuoc-suc-khoe';
update categories set sort_order = 4 where slug = 'thoi-trang-phu-kien';
update categories set sort_order = 5 where slug = 'thiet-bi-dien-dien-tu';
update categories set sort_order = 6 where slug = 'my-pham-cham-soc-ca-nhan';
update categories set sort_order = 7 where slug = 'noi-that-van-phong-pham';
update categories set sort_order = 8 where slug = 'xay-dung-thiet-ke';
update categories set sort_order = 9 where slug = 'dich-vu-sua-chua';
update categories set sort_order = 10 where slug = 'du-lich-da-ngoai';
update categories set sort_order = 11 where slug = 'sach-do-dung-hoc-tap';
update categories set sort_order = 12 where slug = 'nganh-hang-khac';

-- Danh mục con (Loại sản phẩm) cho "THỰC PHẨM ĐÃ CHẾ BIẾN & ĐỒ UỐNG" — dự án
-- hiện tại là tiệm bánh, nên 8 danh mục bánh cũ (CATEGORIES trong
-- src/lib/products.js) trở thành con của danh mục cha #1, GIỮ NGUYÊN tên
-- cũ để câu lệnh backfill bên dưới khớp chính xác, không mất dữ liệu.
insert into categories (slug, name, parent_id, sort_order)
select v.slug, v.name, p.id, v.sort_order
from (values
  ('banh-sinh-nhat', 'Bánh sinh nhật', 1),
  ('banh-kem', 'Bánh kem', 2),
  ('cupcake', 'Cupcake', 3),
  ('banh-mi-croissant', 'Bánh mì & Croissant', 4),
  ('donut', 'Donut', 5),
  ('banh-quy', 'Bánh quy', 6),
  ('banh-trung-thu', 'Bánh Trung thu', 7),
  ('banh-su-kem', 'Bánh su kem', 8)
) as v(slug, name, sort_order)
join categories p on p.slug = 'thuc-pham-che-bien-do-uong'
on conflict (slug) do nothing;

-- Ví dụ minh hoạ thêm 2 cấp con cho vài danh mục cha khác, để Sidebar không
-- trống hoàn toàn ở 10 danh mục còn lại — chỉ mang tính GỢI Ý BAN ĐẦU, Admin
-- sửa/xoá/thêm thoải mái sau (qua Table Editor hoặc Dashboard Admin ở lượt
-- kế tiếp) mà không ảnh hưởng sản phẩm/danh mục đã có.
insert into categories (slug, name, parent_id, sort_order)
select v.slug, v.name, p.id, v.sort_order
from (values
  ('ao-nam', 'Áo nam', 1),
  ('ao-nu', 'Áo nữ', 2),
  ('giay-dep', 'Giày dép', 3),
  ('tui-vi', 'Túi ví', 4)
) as v(slug, name, sort_order)
join categories p on p.slug = 'thoi-trang-phu-kien'
on conflict (slug) do nothing;

insert into categories (slug, name, parent_id, sort_order)
select v.slug, v.name, p.id, v.sort_order
from (values
  ('dien-thoai-may-tinh-bang', 'Điện thoại & Máy tính bảng', 1),
  ('laptop-may-tinh', 'Laptop & Máy tính', 2),
  ('thiet-bi-gia-dung', 'Thiết bị gia dụng', 3),
  ('phu-kien-dien-tu', 'Phụ kiện điện tử', 4)
) as v(slug, name, sort_order)
join categories p on p.slug = 'thiet-bi-dien-dien-tu'
on conflict (slug) do nothing;

-- Thuộc tính có thể LỌC cho danh mục "Bánh sinh nhật" (ví dụ minh hoạ) — key
-- cần khớp với attr.key trong products.attributes (jsonb) đã nhập ở trang
-- /seller/products/[id] thì bộ lọc động trên frontend mới đối chiếu được.
insert into category_attributes (category_id, key, label, input_type, options, sort_order)
select c.id, v.key, v.label, v.input_type, v.options, v.sort_order
from (values
  ('trong_luong', 'Trọng lượng', 'select', array['500g','1kg','1.5kg','2kg']::text[], 1),
  ('xuat_xu', 'Xuất xứ', 'text', null::text[], 2)
) as v(key, label, input_type, options, sort_order)
join categories c on c.slug = 'banh-sinh-nhat'
on conflict (category_id, key) do nothing;

-- Backfill: gắn category_id cho sản phẩm ĐÃ CÓ TỪ TRƯỚC (đăng qua trang
-- /seller/products/new, đang chỉ lưu category dạng text tự do) bằng cách
-- khớp CHÍNH XÁC tên với danh mục con vừa tạo ở trên. Sản phẩm có category
-- không khớp tên nào (vd người bán tự nhập danh mục khác) sẽ giữ
-- category_id = null — vẫn hiển thị bình thường ở trang /products cũ (lọc
-- theo cột category text), chỉ chưa xuất hiện ở trang /danh-muc/[slug] mới
-- cho tới khi được gán lại danh mục (tính năng chọn category_id cho người
-- bán/admin sẽ làm ở lượt Dashboard Admin kế tiếp).
update products p
set category_id = c.id
from categories c
where p.category_id is null
  and c.parent_id is not null
  and c.name = p.category;
