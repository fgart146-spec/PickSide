-- Admin-manageable poll categories (Step 1 of the ops-review plan).
--
-- `polls.category` has been a fixed Postgres enum since day one, mirrored by
-- the hardcoded POLL_CATEGORIES constant in src/lib/categories.ts. That
-- means adding a category has always required a schema migration AND a code
-- deploy — the whole point of this migration is to let admins do it from
-- the UI instead.
--
-- Safety approach: this is additive only.
--   - The `categories` table is new.
--   - `polls.category_id` is a new column, backfilled from the existing
--     enum values below, then set NOT NULL once every row has a value.
--   - The original `polls.category` enum column is NOT dropped and NOT
--     touched. Existing code that still reads it keeps working exactly as
--     before; it becomes a legacy/display fallback going forward.
--   - No existing poll, vote, comment, or category value is deleted or
--     renamed by this migration.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  icon text,
  color text,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  show_on_home boolean not null default true,
  is_system boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Slug uniqueness only among non-deleted rows, so a deleted category's slug
-- can be reused by a new one without a manual rename first.
create unique index if not exists categories_slug_active_idx
  on public.categories (slug) where not is_deleted;
create index if not exists categories_display_order_idx on public.categories (display_order);
create index if not exists categories_is_deleted_idx on public.categories (is_deleted);

alter table public.categories enable row level security;

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;

create policy "Visible categories are public; admins see everything"
  on public.categories for select
  using (
    (is_visible and not is_deleted)
    or exists (
      select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin
    )
  );

create policy "Admins can manage categories"
  on public.categories for all
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin)
  )
  with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

-- ---------------------------------------------------------------------------
-- Seed: the 6 categories that already exist as enum values, in their
-- current display order, plus the system "미분류" (uncategorized) bucket
-- that deleted categories' polls fall back to. is_system rows can't be
-- deleted (enforced in the admin action, not just here).
-- ---------------------------------------------------------------------------
insert into public.categories (name, slug, icon, color, display_order, is_visible, show_on_home, is_system)
select * from (values
  ('일상', 'daily', '☀️', '#38bdf8', 0, true, true, false),
  ('음식', 'food', '🍕', '#fb923c', 1, true, true, false),
  ('연애', 'love', '❤️', '#fb7185', 2, true, true, false),
  ('게임', 'game', '🎮', '#3b82f6', 3, true, true, false),
  ('밸런스', 'balance', '⚖️', '#8b5cf6', 4, true, true, false),
  ('기타', 'etc', '✨', '#a78bfa', 5, true, true, false),
  ('미분류', 'uncategorized', '📁', '#94a3b8', 999, false, false, true)
) as seed(name, slug, icon, color, display_order, is_visible, show_on_home, is_system)
where not exists (select 1 from public.categories c where c.slug = seed.slug and not c.is_deleted);

-- ---------------------------------------------------------------------------
-- polls.category_id: new FK, backfilled from the legacy enum column.
-- ---------------------------------------------------------------------------
alter table public.polls add column if not exists category_id uuid references public.categories (id);

update public.polls p
set category_id = c.id
from public.categories c
where p.category_id is null and c.name = p.category::text and not c.is_system;

-- Any row whose enum value didn't match a seeded name (shouldn't happen,
-- guards against drift) falls back to the system 미분류 category instead of
-- being left null.
update public.polls p
set category_id = (select id from public.categories where slug = 'uncategorized')
where p.category_id is null;

alter table public.polls alter column category_id set not null;

create index if not exists polls_category_id_idx on public.polls (category_id);
