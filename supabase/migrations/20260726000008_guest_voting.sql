-- Guest voting via Supabase anonymous sign-in. Anonymous users get a real
-- auth.users row (is_anonymous = true) so the existing votes.voter_id FK
-- and one-vote-per-poll unique constraint keep working unchanged. Poll
-- creation stays restricted to non-anonymous (real) accounts.

alter table public.profiles
  add column if not exists is_anonymous boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
begin
  base_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(new.raw_user_meta_data ->> 'user_name', ''),
    nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(new.email, '@', 1), ''),
    'guest_' || substr(new.id::text, 1, 8)
  );

  begin
    insert into public.profiles (id, username, is_anonymous)
    values (new.id, base_username, coalesce(new.is_anonymous, false));
  exception when unique_violation then
    insert into public.profiles (id, username, is_anonymous)
    values (new.id, base_username || '_' || substr(new.id::text, 1, 4), coalesce(new.is_anonymous, false))
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;

-- Only non-anonymous (real) accounts may create polls.
drop policy if exists "Authenticated users can create polls" on public.polls;

create policy "Only non-anonymous users can create polls"
  on public.polls for insert
  with check (
    auth.uid() = owner_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );
