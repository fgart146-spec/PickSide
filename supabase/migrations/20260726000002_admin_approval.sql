-- Admin role flag + poll moderation workflow.
-- New polls start as 'pending' and are only public once an admin sets them
-- to 'published'. Options and votes inherit their poll's visibility.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

alter table public.polls
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'published', 'rejected'));

create index if not exists polls_status_idx on public.polls (status);

grant update on public.polls to authenticated;

-- ---------------------------------------------------------------------------
-- polls: replace the "everyone can see everything" policy
-- ---------------------------------------------------------------------------
drop policy if exists "Polls are viewable by everyone" on public.polls;

create policy "Published polls are public; owners and admins see all"
  on public.polls for select
  using (
    status = 'published'
    or owner_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

create policy "Admins can update poll status"
  on public.polls for update
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
-- poll_options: follow the parent poll's visibility
-- ---------------------------------------------------------------------------
drop policy if exists "Poll options are viewable by everyone" on public.poll_options;

create policy "Poll options follow their poll's visibility"
  on public.poll_options for select
  using (
    exists (
      select 1 from public.polls
      where polls.id = poll_options.poll_id
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

-- ---------------------------------------------------------------------------
-- votes: follow the parent poll's visibility; only allow voting on
-- published polls
-- ---------------------------------------------------------------------------
drop policy if exists "Votes are viewable by everyone" on public.votes;

create policy "Votes follow their poll's visibility"
  on public.votes for select
  using (
    exists (
      select 1 from public.polls
      where polls.id = votes.poll_id
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

drop policy if exists "Authenticated users can cast their own vote" on public.votes;

create policy "Authenticated users can vote on published polls"
  on public.votes for insert
  with check (
    auth.uid() = voter_id
    and exists (
      select 1 from public.polls
      where polls.id = votes.poll_id and polls.status = 'published'
    )
  );
