-- Step 4 of the ops-review plan: while testing trash-restore for a poll
-- comment, found that public.comments was never granted to service_role —
-- the same gap already found and fixed once for community_posts/
-- community_comments (Step 2) and audit_log (Step 3). A systematic check
-- (selecting every table as service_role) turned up the full list of
-- tables with the same gap: any admin action that reaches them through
-- createServiceClient() has been silently failing.
--
-- Fix all of them at once instead of continuing to patch one at a time as
-- each is discovered through testing.
grant select, insert, update, delete on public.comments to service_role;
grant select, insert, update, delete on public.community_posts to service_role;
grant select, insert, update, delete on public.community_comments to service_role;
grant select, insert, update, delete on public.community_post_likes to service_role;
grant select, insert, update, delete on public.reports to service_role;
grant select, insert, update, delete on public.community_reports to service_role;
