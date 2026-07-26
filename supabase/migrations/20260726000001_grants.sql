-- Supabase's SQL Editor runs as a role that does not automatically receive
-- the default privileges the Table Editor UI grants, so anon/authenticated
-- need explicit GRANTs in addition to the RLS policies from the previous
-- migration. RLS still governs row visibility; this only unlocks table access.

grant usage on schema public to anon, authenticated;

grant select on public.profiles, public.polls, public.poll_options, public.votes
  to anon, authenticated;

grant insert, update on public.profiles to authenticated;
grant insert, delete on public.polls to authenticated;
grant insert on public.poll_options to authenticated;
grant insert, update, delete on public.votes to authenticated;
