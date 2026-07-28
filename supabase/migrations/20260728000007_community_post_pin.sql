-- Step 14 of the ops-review plan: community activation features (pinned
-- board notices). Mirrors polls.is_pinned exactly.

alter table public.community_posts
  add column if not exists is_pinned boolean not null default false;

create index if not exists community_posts_is_pinned_idx on public.community_posts (is_pinned);
