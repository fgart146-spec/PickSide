-- Denormalized vote/comment counts on polls.
--
-- The homepage and list views previously asked PostgREST to aggregate
-- votes(count)/comments(count) per row on every request, which is the most
-- expensive part of those queries as the tables grow. We instead keep two
-- counter columns on polls, maintained by triggers, so list queries need no
-- per-row aggregation. Mirrors the existing view_count pattern.

alter table public.polls
  add column if not exists vote_count integer not null default 0,
  add column if not exists comment_count integer not null default 0;

-- Backfill existing rows.
update public.polls p set
  vote_count = coalesce((select count(*) from public.votes v where v.poll_id = p.id), 0),
  comment_count = coalesce((select count(*) from public.comments c where c.poll_id = p.id), 0);

-- ---------------------------------------------------------------------------
-- vote_count maintenance
-- ---------------------------------------------------------------------------
create or replace function public.bump_poll_vote_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.polls set vote_count = vote_count + 1 where id = new.poll_id;
  elsif tg_op = 'DELETE' then
    update public.polls set vote_count = greatest(vote_count - 1, 0) where id = old.poll_id;
  end if;
  return null;
end;
$$;

drop trigger if exists votes_count_trg on public.votes;
create trigger votes_count_trg
  after insert or delete on public.votes
  for each row execute function public.bump_poll_vote_count();

-- ---------------------------------------------------------------------------
-- comment_count maintenance
-- ---------------------------------------------------------------------------
create or replace function public.bump_poll_comment_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.polls set comment_count = comment_count + 1 where id = new.poll_id;
  elsif tg_op = 'DELETE' then
    update public.polls set comment_count = greatest(comment_count - 1, 0) where id = old.poll_id;
  end if;
  return null;
end;
$$;

drop trigger if exists comments_count_trg on public.comments;
create trigger comments_count_trg
  after insert or delete on public.comments
  for each row execute function public.bump_poll_comment_count();

-- Indexes backing the homepage "popular" (vote_count desc) and "latest"
-- (created_at desc) top-5 widgets so they stay index-only lookups.
create index if not exists polls_vote_count_idx on public.polls (vote_count desc);
create index if not exists polls_created_at_idx on public.polls (created_at desc);
