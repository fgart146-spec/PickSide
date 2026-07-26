-- Foundation for stage 4 (admin ops): an audit log every future admin
-- action writes to, and soft-delete columns on the four content tables so
-- admin deletes can be recovered from a trash view instead of being
-- immediately destructive. Regular users deleting their OWN content still
-- hard-deletes (unchanged) — soft delete applies to admin-initiated
-- moderation only.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_target_idx on public.audit_log (target_type, target_id);

alter table public.audit_log enable row level security;

grant select, insert on public.audit_log to authenticated;

create policy "Admins can view the audit log"
  on public.audit_log for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

create policy "Admins can write to the audit log"
  on public.audit_log for insert
  with check (
    auth.uid() = admin_id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

-- ---------------------------------------------------------------------------
-- Soft-delete columns
-- ---------------------------------------------------------------------------
alter table public.polls add column if not exists deleted_at timestamptz;
alter table public.comments add column if not exists deleted_at timestamptz;
alter table public.community_posts add column if not exists deleted_at timestamptz;
alter table public.community_comments add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- polls: exclude soft-deleted rows from the normal visibility rules;
-- admins still see everything (needed for the trash view).
-- ---------------------------------------------------------------------------
drop policy if exists "Published polls are public; owners and admins see all" on public.polls;

create policy "Published polls are public; owners and admins see all"
  on public.polls for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
    or (
      deleted_at is null
      and (status = 'published' or owner_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- comments: same treatment, plus grant/policy for admins to set deleted_at.
-- ---------------------------------------------------------------------------
drop policy if exists "Comments follow their poll's visibility" on public.comments;

create policy "Comments follow their poll's visibility"
  on public.comments for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
    or (
      deleted_at is null
      and exists (
        select 1 from public.polls
        where polls.id = comments.poll_id
          and (polls.status = 'published' or polls.owner_id = auth.uid())
      )
    )
  );

grant update on public.comments to authenticated;

create policy "Admins can soft-delete comments"
  on public.comments for update
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

-- ---------------------------------------------------------------------------
-- community_posts: was "viewable by everyone" outright; now excludes
-- soft-deleted rows for non-admins. Admin update policy added for
-- soft-delete (authors already have their own update policy for edits).
-- ---------------------------------------------------------------------------
drop policy if exists "Community posts are viewable by everyone" on public.community_posts;

create policy "Community posts are viewable by everyone"
  on public.community_posts for select
  using (
    deleted_at is null
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

create policy "Admins can update any community post"
  on public.community_posts for update
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

-- ---------------------------------------------------------------------------
-- community_comments: same treatment as comments.
-- ---------------------------------------------------------------------------
drop policy if exists "Community comments are viewable by everyone" on public.community_comments;

create policy "Community comments are viewable by everyone"
  on public.community_comments for select
  using (
    deleted_at is null
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

grant update on public.community_comments to authenticated;

create policy "Admins can soft-delete community comments"
  on public.community_comments for update
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
