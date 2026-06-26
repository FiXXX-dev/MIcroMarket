-- ═══════════════════════════════════════════════════════
--  МикроМаркет · Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. PRODUCTS
create table if not exists products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  price      integer not null check (price > 0),
  emoji      text not null default '🛍',
  category   text not null check (category in ('Напитки', 'Снеки', 'Еда', 'Кофе')),
  badge      text check (badge in ('hit', 'new', 'sale', 'last')),
  image_url  text,
  visible    boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. ORDERS
create table if not exists orders (
  id         uuid primary key default gen_random_uuid(),
  items      jsonb not null,
  total      integer not null check (total >= 0),
  status     text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

-- 3. BANNERS
create table if not exists banners (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  emoji      text not null default '🔥',
  color      text not null default '#FFD600',
  image_url  text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Row Level Security (MVP: anon key has full access) ──
alter table products enable row level security;
alter table orders   enable row level security;
alter table banners  enable row level security;

create policy "products_all" on products for all using (true) with check (true);
create policy "orders_all"   on orders   for all using (true) with check (true);
create policy "banners_all"  on banners  for all using (true) with check (true);

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

-- ── Seed: initial products ──
insert into products (name, price, emoji, category, badge) values
  ('Вода Nestle 0.5л',      3000,  '💧', 'Напитки', null),
  ('Coca-Cola 0.5л',        8000,  '🥤', 'Напитки', 'hit'),
  ('Red Bull 0.25л',        15000, '⚡', 'Напитки', null),
  ('Сок Rich яблоко',       7000,  '🍎', 'Напитки', null),
  ('Сникерс',               5000,  '🍫', 'Снеки',   'hit'),
  ('Чипсы Lays',            9000,  '🥔', 'Снеки',   null),
  ('Орехи ассорти',         12000, '🥜', 'Снеки',   null),
  ('Протеиновый батончик',  18000, '💪', 'Снеки',   'new'),
  ('Сэндвич с курицей',     22000, '🥪', 'Еда',     'hit'),
  ('Салат Цезарь',          28000, '🥗', 'Еда',     null),
  ('Пирожок с мясом',       8000,  '🥟', 'Еда',     null),
  ('Йогурт Активиа',        9000,  '🫙', 'Еда',     null),
  ('Американо',             12000, '☕', 'Кофе',    null),
  ('Капучино',              15000, '☕', 'Кофе',    'hit'),
  ('Чай зелёный',           8000,  '🍵', 'Кофе',    null);

-- ── Seed: default banner ──
insert into banners (text, emoji, color, active) values
  ('Свежая еда и напитки — прямо здесь!', '🔥', '#FFD600', true);
