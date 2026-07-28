-- Step 3 of the ops-review plan: audit log entries should capture the
-- before/after values of what changed, not just the action name + reason
-- text. Additive only — existing rows simply have null before/after.

alter table public.audit_log add column if not exists before_value jsonb;
alter table public.audit_log add column if not exists after_value jsonb;

-- The original migration only granted authenticated (select, insert), never
-- service_role. Every admin action that logs via the service-role client
-- (categories, community boards, trash restore/permanent-delete, etc.) has
-- therefore been silently failing to write an audit_log row this whole
-- time — logAdminAction() never checked the insert result for an error.
grant select, insert on public.audit_log to service_role;
