-- Poll management extensions for admin: force-unpublish ("hidden" status),
-- pin-to-top, and featured flag. No RLS changes needed beyond the status
-- check — the existing "Admins can update poll status" policy already
-- grants admin full-column UPDATE access to polls.

alter table public.polls
  add column if not exists is_pinned boolean not null default false;

alter table public.polls
  add column if not exists is_featured boolean not null default false;

alter table public.polls drop constraint if exists polls_status_check;

alter table public.polls
  add constraint polls_status_check
  check (status in ('pending', 'published', 'rejected', 'hidden'));

create index if not exists polls_is_pinned_idx on public.polls (is_pinned);
create index if not exists polls_is_featured_idx on public.polls (is_featured);
