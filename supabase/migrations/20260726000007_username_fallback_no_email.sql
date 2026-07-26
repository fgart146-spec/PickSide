-- Kakao sign-in now only requests the "profile_nickname" scope (see
-- KOE205 note in oauth-buttons.tsx), so new.email can be null. The previous
-- fallback chain's last resort, split_part(new.email, '@', 1), would then
-- be null and violate profiles.username's NOT NULL constraint. Add a
-- final synthetic fallback so signup never fails on a missing username.
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
    'user_' || substr(new.id::text, 1, 8)
  );

  begin
    insert into public.profiles (id, username)
    values (new.id, base_username);
  exception when unique_violation then
    insert into public.profiles (id, username)
    values (new.id, base_username || '_' || substr(new.id::text, 1, 4))
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;
