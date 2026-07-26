-- Reports on polls and comments. Only non-anonymous (real) accounts can
-- report, mirroring the poll-creation/comment rule. Only admins can read
-- or resolve reports.
do $$ begin
  create type public.report_target_type as enum ('poll', 'comment');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type public.report_target_type not null,
  poll_id uuid references public.polls (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 300),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint reports_target_shape check (
    (target_type = 'poll' and poll_id is not null and comment_id is null)
    or (target_type = 'comment' and comment_id is not null and poll_id is null)
  )
);

create unique index if not exists reports_unique_poll_reporter
  on public.reports (reporter_id, poll_id)
  where target_type = 'poll';

create unique index if not exists reports_unique_comment_reporter
  on public.reports (reporter_id, comment_id)
  where target_type = 'comment';

create index if not exists reports_status_idx on public.reports (status);

alter table public.reports enable row level security;

grant select, insert, update on public.reports to authenticated;

create policy "Non-anonymous users can file reports"
  on public.reports for insert
  with check (
    auth.uid() = reporter_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Admins can view reports"
  on public.reports for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

create policy "Admins can update report status"
  on public.reports for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );
