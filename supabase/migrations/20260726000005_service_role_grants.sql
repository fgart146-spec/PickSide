-- Fix: service_role bypasses RLS but still needs standard table GRANTs.
-- Since our tables were created via the SQL Editor (not the Table Editor
-- UI), service_role never got its usual default privileges. This blocked
-- the approve-poll image-promotion step (private -> public bucket move),
-- which runs with the service-role client.
grant usage on schema public to service_role;
grant all on public.profiles, public.polls, public.poll_options, public.votes to service_role;
