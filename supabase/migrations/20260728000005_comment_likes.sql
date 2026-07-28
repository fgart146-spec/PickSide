-- Step 11 of the ops-review plan: poll result screen enhancements
-- (popular comments, majority/minority opinion tagging). Poll comments had
-- no like mechanism at all — mirrors the existing community_post_likes
-- table/policies exactly. service_role is granted from the start this
-- time (earlier steps found several tables missing it after the fact).

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_likes_comment_id_idx on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;

grant select on public.comment_likes to anon, authenticated;
grant insert, delete on public.comment_likes to authenticated;
grant all on public.comment_likes to service_role;

create policy "Comment likes are viewable by everyone"
  on public.comment_likes for select
  using (true);

create policy "Non-anonymous users can like comments"
  on public.comment_likes for insert
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can remove their own comment like"
  on public.comment_likes for delete
  using (auth.uid() = user_id);
