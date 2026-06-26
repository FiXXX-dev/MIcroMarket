-- ═══════════════════════════════════════════════════════
--  МикроМаркет · Migration: image support
--  Run this in: Supabase Dashboard → SQL Editor
--  (Safe to run on a database that already has the base schema.)
-- ═══════════════════════════════════════════════════════

-- 1. Add image_url columns
alter table products add column if not exists image_url text;
alter table banners  add column if not exists image_url text;

-- 2. Create the public storage bucket for uploaded images
insert into storage.buckets (id, name, public)
values ('market-images', 'market-images', true)
on conflict (id) do update set public = true;

-- 3. Storage policies (MVP: anon key may read/write objects in this bucket)
drop policy if exists "market_images_read"   on storage.objects;
drop policy if exists "market_images_insert" on storage.objects;
drop policy if exists "market_images_update" on storage.objects;
drop policy if exists "market_images_delete" on storage.objects;

create policy "market_images_read"   on storage.objects
  for select using (bucket_id = 'market-images');
create policy "market_images_insert" on storage.objects
  for insert with check (bucket_id = 'market-images');
create policy "market_images_update" on storage.objects
  for update using (bucket_id = 'market-images') with check (bucket_id = 'market-images');
create policy "market_images_delete" on storage.objects
  for delete using (bucket_id = 'market-images');
