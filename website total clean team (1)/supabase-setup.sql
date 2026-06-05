-- =====================================================================
-- Thury Group Kft. — Supabase setup
-- Run this once in the SQL Editor (Supabase Dashboard → SQL Editor → New Query)
-- Safe to re-run; everything uses CREATE IF NOT EXISTS / DROP+CREATE policy.
-- =====================================================================


-- =====================================================================
-- 1. QUOTE REQUESTS — submissions from ajanlat.html
-- =====================================================================

create table if not exists public.quote_requests (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  email         text not null,
  phone         text not null,
  message       text not null,
  attachments   jsonb not null default '[]'::jsonb,
  source        text default 'website',
  user_agent    text,
  ip_address    text
);

create index if not exists quote_requests_created_at_idx
  on public.quote_requests (created_at desc);

alter table public.quote_requests enable row level security;

drop policy if exists "anon can insert quote_requests" on public.quote_requests;
create policy "anon can insert quote_requests"
  on public.quote_requests for insert to anon with check (true);

drop policy if exists "authenticated can read quote_requests" on public.quote_requests;
create policy "authenticated can read quote_requests"
  on public.quote_requests for select to authenticated using (true);


-- =====================================================================
-- 2. PORTFOLIO ITEMS — referenced from portfolio.html + the homepage
-- =====================================================================

create table if not exists public.portfolio_items (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  title       text not null,
  subtitle    text,
  image_url   text,
  sort_order  int  not null default 0
);

create index if not exists portfolio_items_sort_idx
  on public.portfolio_items (sort_order asc, created_at desc);

alter table public.portfolio_items enable row level security;

drop policy if exists "public can read portfolio_items" on public.portfolio_items;
create policy "public can read portfolio_items"
  on public.portfolio_items for select to anon, authenticated using (true);

drop policy if exists "authenticated can write portfolio_items" on public.portfolio_items;
create policy "authenticated can write portfolio_items"
  on public.portfolio_items for all to authenticated using (true) with check (true);


-- =====================================================================
-- 3. MACHINES — referenced from gepberles.html
-- =====================================================================

create table if not exists public.machines (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  tag          text,           -- e.g. "Bérelhető", "Hamarosan"
  description  text,
  image_url    text,
  sort_order   int  not null default 0
);

create index if not exists machines_sort_idx
  on public.machines (sort_order asc, created_at desc);

alter table public.machines enable row level security;

drop policy if exists "public can read machines" on public.machines;
create policy "public can read machines"
  on public.machines for select to anon, authenticated using (true);

drop policy if exists "authenticated can write machines" on public.machines;
create policy "authenticated can write machines"
  on public.machines for all to authenticated using (true) with check (true);


-- =====================================================================
-- 4. STORAGE BUCKETS
-- =====================================================================

-- 4a. Quote attachments (already in use by ajanlat.html)
insert into storage.buckets (id, name, public, file_size_limit)
values ('quote-attachments', 'quote-attachments', true, 10485760)
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit;

-- 4b. Portfolio images
insert into storage.buckets (id, name, public, file_size_limit)
values ('portfolio-images', 'portfolio-images', true, 10485760)
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit;

-- 4c. Machine images
insert into storage.buckets (id, name, public, file_size_limit)
values ('machine-images', 'machine-images', true, 10485760)
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit;


-- =====================================================================
-- 5. STORAGE POLICIES
-- =====================================================================

-- Anyone can read every public bucket
drop policy if exists "public can read public buckets" on storage.objects;
create policy "public can read public buckets"
  on storage.objects for select to anon, authenticated
  using (bucket_id in ('quote-attachments', 'portfolio-images', 'machine-images'));

-- Anonymous visitors can upload to the quote-attachments bucket (form uploads)
drop policy if exists "anon can upload to quote-attachments" on storage.objects;
create policy "anon can upload to quote-attachments"
  on storage.objects for insert to anon
  with check (bucket_id = 'quote-attachments');

-- Admins (authenticated users) can manage portfolio + machine images
drop policy if exists "authenticated can write portfolio-images" on storage.objects;
create policy "authenticated can write portfolio-images"
  on storage.objects for all to authenticated
  using (bucket_id = 'portfolio-images')
  with check (bucket_id = 'portfolio-images');

drop policy if exists "authenticated can write machine-images" on storage.objects;
create policy "authenticated can write machine-images"
  on storage.objects for all to authenticated
  using (bucket_id = 'machine-images')
  with check (bucket_id = 'machine-images');


-- =====================================================================
-- 6. SEED DATA — migrate the hardcoded portfolio references
-- (Only inserts if the table is empty, so safe to re-run.)
-- =====================================================================

insert into public.portfolio_items (title, subtitle, sort_order)
select * from (values
  ('Ritz Levente Sportcsarnok',  'Sztár Box ideje alatt is', 10),
  ('Budapest Óriáskereke',        null,                       20),
  ('Morgan Stanley irodaház',     'éves nagytakarítás',       30),
  ('Lőrinc Piac',                 'Pestszentlőrinc',          40),
  ('Príma Pék üzem',              'és ipari sütöde · Budakalász', 50),
  ('Lázár Lovaspark',             'Domonyvölgy',              60),
  ('Kecskeméti Élményfürdő',      'és Csúszdapark',           70),
  ('Messzi István Sportcsarnok',  'Kecskemét',                80)
) as v(title, subtitle, sort_order)
where not exists (select 1 from public.portfolio_items);
