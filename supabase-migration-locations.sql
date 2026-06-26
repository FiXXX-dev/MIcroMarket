-- ═══════════════════════════════════════════════════════
--  МикроМаркет · Migration: multi-location support
--  Run this in: Supabase Dashboard → SQL Editor
--  Safe to run after the base schema + image migration.
-- ═══════════════════════════════════════════════════════

-- 1. LOCATIONS table
create table if not exists locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table locations enable row level security;
drop policy if exists "locations_all" on locations;
create policy "locations_all" on locations for all using (true) with check (true);

-- 2. PRODUCTS: location_id + quantity
alter table products add column if not exists location_id uuid references locations(id) on delete cascade;
alter table products add column if not exists quantity    integer not null default 0;

-- 3. BANNERS: location_id (null = global / all locations)
alter table banners add column if not exists location_id uuid references locations(id) on delete cascade;

-- 4. ORDERS: location_id (which point the sale happened at)
alter table orders add column if not exists location_id uuid references locations(id) on delete set null;

-- 5. Seed a default location if none exists, and attach existing data to it
insert into locations (name, address)
select 'БЦ Навои · этаж 3', 'Ташкент'
where not exists (select 1 from locations);

update products
  set location_id = (select id from locations order by created_at limit 1)
  where location_id is null;

-- give pre-existing products a non-zero stock so they aren't all "out of stock"
update products set quantity = 99 where quantity = 0;

update banners
  set location_id = (select id from locations order by created_at limit 1)
  where location_id is null;
