-- Google/Kakao OAuth profiles don't carry a "username" field the way our
-- email/password signup form does, and different providers expose the
-- display name under different metadata keys. Broaden the fallback chain
-- and, since username is unique, resolve collisions deterministically by
-- appending part of the user's id instead of failing the whole signup.
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
    split_part(new.email, '@', 1)
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
