-- Stage 4-4 (user management): suspend/ban fields on profiles, plus the
-- guardrails that make them actually enforceable.
--
-- Two things beyond the plain columns are required for this feature to be
-- real moderation rather than a UI suggestion:
--   1. Admins need an UPDATE policy that reaches OTHER users' profile rows
--      (the existing self-only policy only ever matched auth.uid() = id).
--   2. The existing self-update policy has no column-level restriction, so
--      without a guard a signed-in user could call
--      `supabase.from('profiles').update({ suspended_until: null })`
--      directly and lift their own suspension (or, pre-existing to this
--      migration, set is_admin = true on themselves). A BEFORE UPDATE
--      trigger closes both holes: it reverts is_admin/suspended_until/
--      banned_at/suspend_reason back to their old values unless the row is
--      being written by an admin.

alter table public.profiles add column if not exists suspended_until timestamptz;
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists suspend_reason text;

create index if not exists profiles_suspended_until_idx on public.profiles (suspended_until);
create index if not exists profiles_banned_at_idx on public.profiles (banned_at);

create policy "Admins can update any profile"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  acting_is_admin boolean;
begin
  select is_admin into acting_is_admin from public.profiles where id = auth.uid();

  if coalesce(acting_is_admin, false) then
    return new;
  end if;

  new.is_admin := old.is_admin;
  new.suspended_until := old.suspended_until;
  new.banned_at := old.banned_at;
  new.suspend_reason := old.suspend_reason;
  return new;
end;
$$;

drop trigger if exists protect_privileged_profile_columns on public.profiles;

create trigger protect_privileged_profile_columns
before update on public.profiles
for each row execute function public.protect_privileged_profile_columns();
