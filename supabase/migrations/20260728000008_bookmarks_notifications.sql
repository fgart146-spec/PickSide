-- Step 15 of the ops-review plan: user retention features — bookmarks and
-- in-app notifications. Explicitly no points/cash rewards per the plan.

-- ---------------------------------------------------------------------------
-- poll_bookmarks — private per-user saved list, mirrors the *_likes tables.
-- ---------------------------------------------------------------------------
create table if not exists public.poll_bookmarks (
  poll_id uuid not null references public.polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index if not exists poll_bookmarks_user_id_idx on public.poll_bookmarks (user_id);

alter table public.poll_bookmarks enable row level security;

grant select, insert, delete on public.poll_bookmarks to authenticated;
grant all on public.poll_bookmarks to service_role;

create policy "Users can view their own bookmarks"
  on public.poll_bookmarks for select
  using (auth.uid() = user_id);

create policy "Users can bookmark polls"
  on public.poll_bookmarks for insert
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can remove their own bookmark"
  on public.poll_bookmarks for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- notifications — in-app only (no email/push). The actor who triggers a
-- notification (e.g. a commenter) is never the recipient, so inserts always
-- go through the service-role client; there is deliberately no INSERT
-- policy for `authenticated` here, only select/update of one's own rows.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  message text not null,
  link text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_is_read_idx on public.notifications (user_id, is_read);

alter table public.notifications enable row level security;

grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

create policy "Users view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark their own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
