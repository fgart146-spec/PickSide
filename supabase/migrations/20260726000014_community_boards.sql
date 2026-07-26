-- Community boards: 자유/유머/고민질문/밸런스 게임 추천. Kept as fully
-- separate tables/routes from polls (per the "DB와 라우트를 명확히 구분"
-- requirement) but reusing the same auth/profiles system. Unlike polls,
-- community posts have no approval workflow — they're public immediately.

do $$ begin
  create type public.community_board as enum ('free', 'humor', 'question', 'balance_suggestion');
exception
  when duplicate_object then null;
end $$;

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- community_posts
-- ---------------------------------------------------------------------------
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  board public.community_board not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 5000),
  image_path text,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_posts_board_idx on public.community_posts (board);
create index if not exists community_posts_title_trgm_idx
  on public.community_posts using gin (title gin_trgm_ops);
create index if not exists community_posts_body_trgm_idx
  on public.community_posts using gin (body gin_trgm_ops);

alter table public.community_posts enable row level security;

grant select on public.community_posts to anon, authenticated;
grant insert, update, delete on public.community_posts to authenticated;

create policy "Community posts are viewable by everyone"
  on public.community_posts for select
  using (true);

create policy "Non-anonymous users can create community posts"
  on public.community_posts for insert
  with check (
    auth.uid() = author_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Authors can update their own community posts"
  on public.community_posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "Authors and admins can delete community posts"
  on public.community_posts for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

create or replace function public.increment_community_post_view(p_post_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.community_posts set view_count = view_count + 1 where id = p_post_id;
$$;

grant execute on function public.increment_community_post_view(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- community_post_likes (toggleable, unlike poll votes)
-- ---------------------------------------------------------------------------
create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.community_post_likes enable row level security;

grant select on public.community_post_likes to anon, authenticated;
grant insert, delete on public.community_post_likes to authenticated;

create policy "Post likes are viewable by everyone"
  on public.community_post_likes for select
  using (true);

create policy "Non-anonymous users can like posts"
  on public.community_post_likes for insert
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can remove their own like"
  on public.community_post_likes for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- community_comments
-- ---------------------------------------------------------------------------
create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists community_comments_post_id_idx on public.community_comments (post_id);

alter table public.community_comments enable row level security;

grant select on public.community_comments to anon, authenticated;
grant insert, delete on public.community_comments to authenticated;

create policy "Community comments are viewable by everyone"
  on public.community_comments for select
  using (true);

create policy "Non-anonymous users can comment on community posts"
  on public.community_comments for insert
  with check (
    auth.uid() = author_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Authors and admins can delete community comments"
  on public.community_comments for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

-- ---------------------------------------------------------------------------
-- community_reports — separate from the polls "reports" table (its
-- target_type enum already only covers poll/comment; extending a live enum
-- and its CHECK constraint in the same migration is fragile, so a parallel
-- table is the lower-risk choice here).
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.community_report_target_type as enum ('post', 'comment');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  target_type public.community_report_target_type not null,
  post_id uuid references public.community_posts (id) on delete cascade,
  comment_id uuid references public.community_comments (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 300),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint community_reports_target_shape check (
    (target_type = 'post' and post_id is not null and comment_id is null)
    or (target_type = 'comment' and comment_id is not null and post_id is null)
  )
);

create unique index if not exists community_reports_unique_post_reporter
  on public.community_reports (reporter_id, post_id)
  where target_type = 'post';

create unique index if not exists community_reports_unique_comment_reporter
  on public.community_reports (reporter_id, comment_id)
  where target_type = 'comment';

create index if not exists community_reports_status_idx on public.community_reports (status);

alter table public.community_reports enable row level security;

grant select, insert, update on public.community_reports to authenticated;

create policy "Non-anonymous users can file community reports"
  on public.community_reports for insert
  with check (
    auth.uid() = reporter_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Admins can view community reports"
  on public.community_reports for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

create policy "Admins can update community report status"
  on public.community_reports for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: community post images. No approval workflow, so a single public
-- bucket is enough (no private staging step like poll images).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('community-images', 'community-images', true)
on conflict (id) do nothing;

drop policy if exists "Community images are readable by everyone" on storage.objects;

create policy "Community images are readable by everyone"
  on storage.objects for select
  using (bucket_id = 'community-images');

drop policy if exists "Authors manage their own community post images" on storage.objects;

create policy "Authors manage their own community post images"
  on storage.objects for all
  using (
    bucket_id = 'community-images'
    and exists (
      select 1 from public.community_posts
      where community_posts.id::text = (storage.foldername(name))[1]
        and (
          community_posts.author_id = auth.uid()
          or exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.is_admin
          )
        )
    )
  )
  with check (
    bucket_id = 'community-images'
    and exists (
      select 1 from public.community_posts
      where community_posts.id::text = (storage.foldername(name))[1]
        and community_posts.author_id = auth.uid()
    )
  );
