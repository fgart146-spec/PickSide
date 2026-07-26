-- View count for polls, incremented via a SECURITY DEFINER function so
-- anon/authenticated callers don't need a broad UPDATE grant on polls.
alter table public.polls
  add column if not exists view_count integer not null default 0;

create or replace function public.increment_poll_view(p_poll_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.polls set view_count = view_count + 1 where id = p_poll_id;
$$;

grant execute on function public.increment_poll_view(uuid) to anon, authenticated;

-- Votes can no longer be changed once cast: drop the update policy and
-- revoke the UPDATE grant so this is enforced at the database layer, not
-- just by the app hiding the vote button after a user has voted.
drop policy if exists "Voters can change their own vote" on public.votes;
revoke update on public.votes from authenticated;
