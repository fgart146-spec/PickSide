-- Admin-manageable community boards (Step 2 of the ops-review plan) —
-- mirrors migration 20260727000009 (poll categories) for the same reasons:
-- `community_posts.board` has been a fixed enum, so adding a board has
-- always needed a schema migration + deploy.
--
-- Safety approach: additive only, same as the categories migration.
--   - `community_boards` is new.
--   - `community_posts.board_id` is a new column, backfilled from the
--     existing enum values, then set NOT NULL.
--   - The legacy `board` enum column is untouched (kept for display
--     fallback / anywhere not yet migrated to board_id).
--   - Board slugs are seeded to EXACTLY match the current enum values
--     (free/humor/question/balance_suggestion), because those values are
--     already live in bookmarked/shared URLs (/community/free etc.) — unlike
--     poll categories, boards don't get a slug redirect layer, the [board]
--     route param IS the slug.

create table if not exists public.community_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  icon text,
  color text,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  allow_posts boolean not null default true,
  allow_comments boolean not null default true,
  allow_images boolean not null default true,
  allow_anonymous boolean not null default false,
  allow_guest_view boolean not null default true,
  admin_only_posting boolean not null default false,
  is_system boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists community_boards_slug_active_idx
  on public.community_boards (slug) where not is_deleted;
create index if not exists community_boards_display_order_idx on public.community_boards (display_order);
create index if not exists community_boards_is_deleted_idx on public.community_boards (is_deleted);

alter table public.community_boards enable row level security;

grant select on public.community_boards to anon, authenticated;
grant insert, update, delete on public.community_boards to authenticated;
grant all on public.community_boards to service_role;

create policy "Visible boards are public; admins see everything"
  on public.community_boards for select
  using (
    (is_visible and not is_deleted)
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin)
  );

create policy "Admins can manage community boards"
  on public.community_boards for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin));

-- ---------------------------------------------------------------------------
-- Seed: the 4 existing boards (slugs match the live enum/URLs exactly) plus
-- a system "보관" (archive) board that deleted boards' posts fall back to.
-- ---------------------------------------------------------------------------
insert into public.community_boards
  (name, slug, icon, color, display_order, is_visible, allow_guest_view, is_system)
select * from (values
  ('자유게시판', 'free', '💬', '#38bdf8', 0, true, true, false),
  ('유머게시판', 'humor', '😂', '#fbbf24', 1, true, true, false),
  ('고민/질문게시판', 'question', '❓', '#8b5cf6', 2, true, true, false),
  ('밸런스 게임 주제 추천', 'balance_suggestion', '⚖️', '#7c5cfc', 3, true, true, false),
  ('보관 게시판', 'archive', '📦', '#94a3b8', 999, false, true, true)
) as seed(name, slug, icon, color, display_order, is_visible, allow_guest_view, is_system)
where not exists (select 1 from public.community_boards b where b.slug = seed.slug and not b.is_deleted);

-- ---------------------------------------------------------------------------
-- community_posts.board_id: new FK, backfilled from the legacy enum column.
-- ---------------------------------------------------------------------------
alter table public.community_posts add column if not exists board_id uuid references public.community_boards (id);

update public.community_posts p
set board_id = b.id
from public.community_boards b
where p.board_id is null and b.slug = p.board::text and not b.is_system;

update public.community_posts p
set board_id = (select id from public.community_boards where slug = 'archive')
where p.board_id is null;

alter table public.community_posts alter column board_id set not null;

create index if not exists community_posts_board_id_idx on public.community_posts (board_id);

-- ---------------------------------------------------------------------------
-- Enforce board settings server-side (not just in the UI): visibility +
-- guest-view for reads, allow_posts/admin_only_posting/allow_anonymous for
-- post inserts, allow_comments for comment inserts.
-- ---------------------------------------------------------------------------
drop policy if exists "Community posts are viewable by everyone" on public.community_posts;

create policy "Community posts follow board visibility"
  on public.community_posts for select
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin)
    or (
      deleted_at is null
      and exists (
        select 1 from public.community_boards b
        where b.id = community_posts.board_id
          and b.is_visible
          and not b.is_deleted
          and (b.allow_guest_view or auth.uid() is not null)
      )
    )
  );

drop policy if exists "Non-anonymous users can create community posts" on public.community_posts;

create policy "Posts respect board posting settings"
  on public.community_posts for insert
  with check (
    auth.uid() = author_id
    and (
      coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
      or exists (
        select 1 from public.community_boards b where b.id = board_id and b.allow_anonymous
      )
    )
    and exists (
      select 1 from public.community_boards b
      where b.id = board_id
        and b.allow_posts
        and not b.is_deleted
        and (
          not b.admin_only_posting
          or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin)
        )
    )
  );

drop policy if exists "Non-anonymous users can comment on community posts" on public.community_comments;

create policy "Comments respect board comment settings"
  on public.community_comments for insert
  with check (
    auth.uid() = author_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1 from public.community_posts p
      join public.community_boards b on b.id = p.board_id
      where p.id = post_id and b.allow_comments and not b.is_deleted
    )
  );

grant all on public.community_boards to service_role;
