-- Let admins record why a report was resolved or dismissed, separate from
-- the reporter's own reason for filing it.
alter table public.reports add column if not exists resolution_note text;
alter table public.community_reports add column if not exists resolution_note text;
