-- AI 직원 사무실(AI office): stores the work produced by the AI "employees"
-- (report reviewer, content planner, stats analyst). The AI never mutates live
-- content directly — it writes recommendations/drafts here, and an admin either
-- applies them (for state changes like resolving a report) or they are already
-- saved as reversible drafts (pending polls, read-only summaries).
create table if not exists public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  -- which AI employee produced this
  role text not null check (role in ('report_review', 'content_plan', 'stats_summary')),
  status text not null default 'completed'
    check (status in ('completed', 'failed', 'applied', 'dismissed')),
  -- how the run was started
  trigger text not null default 'manual' check (trigger in ('manual', 'cron')),
  title text not null,
  summary text,
  -- structured payload (recommendation details, draft ids, raw stats, ...)
  output jsonb,
  -- what this task is about, for dedupe + linking (e.g. 'report' + report id)
  subject_type text,
  subject_id text,
  model text,
  error text,
  created_by uuid references public.profiles (id) on delete set null,
  applied_by uuid references public.profiles (id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_tasks_role_status_idx
  on public.ai_tasks (role, status, created_at desc);

-- Dedupe helper: skip re-reviewing a subject that already has a task.
create index if not exists ai_tasks_subject_idx
  on public.ai_tasks (role, subject_type, subject_id);

alter table public.ai_tasks enable row level security;

grant select, insert, update on public.ai_tasks to authenticated;
grant all on public.ai_tasks to service_role;

-- Only admins can read the AI office.
create policy "Admins can view ai tasks"
  on public.ai_tasks for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

-- Only admins can apply/dismiss recommendations.
create policy "Admins can update ai tasks"
  on public.ai_tasks for update
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

-- Inserts are done server-side with the service-role client (cron + server
-- actions), which bypasses RLS — no authenticated insert policy is needed.
