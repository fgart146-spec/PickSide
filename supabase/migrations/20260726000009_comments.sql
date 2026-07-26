-- Comments on polls. Anyone can read comments on a published poll; only
-- non-anonymous (real) accounts can post, mirroring the poll-creation rule.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists comments_poll_id_idx on public.comments (poll_id);

alter table public.comments enable row level security;

grant select on public.comments to anon, authenticated;
grant insert, delete on public.comments to authenticated;

create policy "Comments follow their poll's visibility"
  on public.comments for select
  using (
    exists (
      select 1 from public.polls
      where polls.id = comments.poll_id
        and (
          polls.status = 'published'
          or polls.owner_id = auth.uid()
          or exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.is_admin
          )
        )
    )
  );

create policy "Non-anonymous users can comment on published polls"
  on public.comments for insert
  with check (
    auth.uid() = author_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1 from public.polls
      where polls.id = comments.poll_id and polls.status = 'published'
    )
  );

create policy "Authors and admins can delete comments"
  on public.comments for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );
