-- Kakao login intentionally requests only the `profile_nickname` scope (the
-- `account_email` scope triggers KOE205 on a personal, non-business-verified
-- Kakao app — see the comment in src/components/oauth-buttons.tsx). That
-- means auth.users.email is NULL for Kakao sign-ins, so the original
-- handle_new_user() fallback (`split_part(new.email, '@', 1)`) has nothing
-- to fall back to, and Kakao's nickname isn't stored under the exact key
-- `username` that the original function checked. Without a valid username,
-- the profiles insert fails its NOT NULL constraint and the whole sign-in
-- silently bounces back to /login?error=oauth.
--
-- This replaces the function (in place — auth.users already references it
-- via the existing trigger, no need to touch that) with a version that:
--   1. Checks several provider-specific metadata keys, not just `username`.
--   2. Falls back to a generated name from the user id if nothing else is
--      available, so signup can never fail on a missing username.
--   3. De-duplicates against the `profiles.username` unique constraint by
--      appending a numeric suffix, instead of letting a collision fail the
--      whole insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
    nullif(new.raw_user_meta_data ->> 'nickname', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'user_' || substr(new.id::text, 1, 8)
  );

  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || '_' || suffix;
  end loop;

  insert into public.profiles (id, username)
  values (new.id, final_username)
  on conflict (id) do nothing;
  return new;
end;
$$;
