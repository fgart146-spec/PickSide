-- PickSide initial schema: profiles, two-sided polls, options, votes.
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- polls
-- ---------------------------------------------------------------------------
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  question text not null check (char_length(question) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table public.polls enable row level security;

create policy "Polls are viewable by everyone"
  on public.polls for select
  using (true);

create policy "Authenticated users can create polls"
  on public.polls for insert
  with check (auth.uid() = owner_id);

create policy "Owners can delete their polls"
  on public.polls for delete
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- poll_options (exactly two per poll — enforced at the application layer)
-- ---------------------------------------------------------------------------
create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  position smallint not null default 0
);

alter table public.poll_options enable row level security;

create policy "Poll options are viewable by everyone"
  on public.poll_options for select
  using (true);

create policy "Poll owners can add options"
  on public.poll_options for insert
  with check (
    exists (
      select 1 from public.polls
      where polls.id = poll_id and polls.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- votes (one vote per poll per voter)
-- ---------------------------------------------------------------------------
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, voter_id)
);

alter table public.votes enable row level security;

create policy "Votes are viewable by everyone"
  on public.votes for select
  using (true);

create policy "Authenticated users can cast their own vote"
  on public.votes for insert
  with check (auth.uid() = voter_id);

create policy "Voters can change their own vote"
  on public.votes for update
  using (auth.uid() = voter_id)
  with check (auth.uid() = voter_id);

create policy "Voters can remove their own vote"
  on public.votes for delete
  using (auth.uid() = voter_id);

create index if not exists votes_poll_id_idx on public.votes (poll_id);
create index if not exists poll_options_poll_id_idx on public.poll_options (poll_id);
