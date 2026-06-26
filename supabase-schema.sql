-- ═══════════════════════════════════════════════════════
--  МикроМаркет · Supabase Schema (multi-location)
--  Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. LOCATIONS (market points)
create table if not exists locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. PRODUCTS
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid references locations(id) on delete cascade,
  name        text not null,
  price       integer not null check (price > 0),
  emoji       text not null default '🛍',
  category    text not null check (category in ('Напитки', 'Снеки', 'Еда', 'Кофе')),
  badge       text check (badge in ('hit', 'new', 'sale', 'last')),
  image_url   text,
  quantity    integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 3. ORDERS
create table if not exists orders (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid references locations(id) on delete set null,
  items       jsonb not null,
  total       integer not null check (total >= 0),
  status      text not null default 'pending' check (status in ('pending', 'paid')),
  created_at  timestamptz not null default now()
);

-- 4. BANNERS
create table if not exists banners (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid references locations(id) on delete cascade,
  text        text not null,
  emoji       text not null default '🔥',
  color       text not null default '#FFD600',
  image_url   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Row Level Security (MVP: anon key has full access) ──
alter table locations enable row level security;
alter table products  enable row level security;
alter table orders    enable row level security;
alter table banners   enable row level security;

create policy "locations_all" on locations for all using (true) with check (true);
create policy "products_all"  on products  for all using (true) with check (true);
create policy "orders_all"    on orders    for all using (true) with check (true);
create policy "banners_all"   on banners   for all using (true) with check (true);

-- ── Storage bucket for uploaded images ──
insert into storage.buckets (id, name, public)
values ('market-images', 'market-images', true)
on conflict (id) do update set public = true;

create policy "market_images_read"   on storage.objects
  for select using (bucket_id = 'market-images');
create policy "market_images_insert" on storage.objects
  for insert with check (bucket_id = 'market-images');
create policy "market_images_update" on storage.objects
  for update using (bucket_id = 'market-images') with check (bucket_id = 'market-images');
create policy "market_images_delete" on storage.objects
  for delete using (bucket_id = 'market-images');

-- ── Seed: default location + its products and banner ──
insert into locations (name, address) values
  ('БЦ Навои · этаж 3', 'Ташкент');

insert into products (location_id, name, price, emoji, category, badge, quantity)
select l.id, p.name, p.price, p.emoji, p.category, p.badge, p.quantity
from (select id from locations order by created_at limit 1) l,
(values
  ('Вода Nestle 0.5л',      3000,  '💧', 'Напитки', null,  99),
  ('Coca-Cola 0.5л',        8000,  '🥤', 'Напитки', 'hit', 99),
  ('Red Bull 0.25л',        15000, '⚡', 'Напитки', null,  99),
  ('Сок Rich яблоко',       7000,  '🍎', 'Напитки', null,  99),
  ('Сникерс',               5000,  '🍫', 'Снеки',   'hit', 99),
  ('Чипсы Lays',            9000,  '🥔', 'Снеки',   null,  99),
  ('Орехи ассорти',         12000, '🥜', 'Снеки',   null,  99),
  ('Протеиновый батончик',  18000, '💪', 'Снеки',   'new', 99),
  ('Сэндвич с курицей',     22000, '🥪', 'Еда',     'hit', 99),
  ('Салат Цезарь',          28000, '🥗', 'Еда',     null,  99),
  ('Пирожок с мясом',       8000,  '🥟', 'Еда',     null,  99),
  ('Йогурт Активиа',        9000,  '🫙', 'Еда',     null,  99),
  ('Американо',             12000, '☕', 'Кофе',    null,  99),
  ('Капучино',              15000, '☕', 'Кофе',    'hit', 99),
  ('Чай зелёный',           8000,  '🍵', 'Кофе',    null,  99)
) as p(name, price, emoji, category, badge, quantity);

insert into banners (location_id, text, emoji, color, active)
select l.id, 'Свежая еда и напитки — прямо здесь!', '🔥', '#FFD600', true
from (select id from locations order by created_at limit 1) l;
