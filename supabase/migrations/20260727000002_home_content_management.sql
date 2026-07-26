-- Stage 4-5: admin-managed home content — notices, popups, event/home
-- banners, ad slots, and home-section visibility/order. All read publicly
-- (using true) since this is promotional/informational content, but every
-- write requires is_admin, matching the pattern used for polls/community
-- moderation elsewhere in this schema.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- notices (공지사항)
-- ---------------------------------------------------------------------------
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.notices enable row level security;

grant select on public.notices to anon, authenticated;
grant insert, update, delete on public.notices to authenticated;

create policy "Notices are viewable by everyone"
  on public.notices for select
  using (true);

create policy "Admins can manage notices"
  on public.notices for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin));

-- ---------------------------------------------------------------------------
-- popups (팝업) — shown on the homepage, dismissible client-side.
-- ---------------------------------------------------------------------------
create table if not exists public.popups (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  body text,
  image_path text,
  link_url text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.popups enable row level security;

grant select on public.popups to anon, authenticated;
grant insert, update, delete on public.popups to authenticated;

create policy "Popups are viewable by everyone"
  on public.popups for select
  using (true);

create policy "Admins can manage popups"
  on public.popups for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin));

-- ---------------------------------------------------------------------------
-- banners (이벤트 배너 / 홈 배너) — one table, split by `kind`.
-- ---------------------------------------------------------------------------
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('event', 'home')),
  title text not null check (char_length(title) between 1 and 200),
  image_path text,
  link_url text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists banners_kind_idx on public.banners (kind);

alter table public.banners enable row level security;

grant select on public.banners to anon, authenticated;
grant insert, update, delete on public.banners to authenticated;

create policy "Banners are viewable by everyone"
  on public.banners for select
  using (true);

create policy "Admins can manage banners"
  on public.banners for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin));

-- ---------------------------------------------------------------------------
-- ad_slots (광고 영역) — one row per reserved position on the homepage.
-- ---------------------------------------------------------------------------
create table if not exists public.ad_slots (
  slot_key text primary key,
  image_path text,
  link_url text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.ad_slots enable row level security;

grant select on public.ad_slots to anon, authenticated;
grant insert, update, delete on public.ad_slots to authenticated;

create policy "Ad slots are viewable by everyone"
  on public.ad_slots for select
  using (true);

create policy "Admins can manage ad slots"
  on public.ad_slots for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin));

insert into public.ad_slots (slot_key)
values ('home-top-banner'), ('home-sidebar-1'), ('home-sidebar-2'), ('home-infeed'), ('home-bottom')
on conflict (slot_key) do nothing;

-- ---------------------------------------------------------------------------
-- home_sections (홈 화면 섹션 노출 여부/순서)
-- ---------------------------------------------------------------------------
create table if not exists public.home_sections (
  key text primary key,
  is_visible boolean not null default true,
  sort_order integer not null,
  updated_at timestamptz not null default now()
);

alter table public.home_sections enable row level security;

grant select on public.home_sections to anon, authenticated;
grant insert, update, delete on public.home_sections to authenticated;

create policy "Home sections are viewable by everyone"
  on public.home_sections for select
  using (true);

create policy "Admins can manage home sections"
  on public.home_sections for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin));

insert into public.home_sections (key, sort_order)
values
  ('featured', 0),
  ('popular', 1),
  ('latest', 2),
  ('random_cta', 3),
  ('stats', 4),
  ('notice_banner', 5)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Storage: shared public bucket for notice/popup/banner/ad images. Admin-only
-- write (no per-owner concept here, unlike poll/community images).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('site-content-images', 'site-content-images', true)
on conflict (id) do nothing;

drop policy if exists "Site content images are readable by everyone" on storage.objects;

create policy "Site content images are readable by everyone"
  on storage.objects for select
  using (bucket_id = 'site-content-images');

drop policy if exists "Admins manage site content images" on storage.objects;

create policy "Admins manage site content images"
  on storage.objects for all
  using (
    bucket_id = 'site-content-images'
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin)
  )
  with check (
    bucket_id = 'site-content-images'
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

grant all on public.notices, public.popups, public.banners, public.ad_slots, public.home_sections to service_role;
