-- Poll option images (A/B). While a poll is pending/rejected, its images
-- live in a private bucket only the owner/admin can read. On approval, the
-- approve action (using the service role, which bypasses RLS) copies them
-- into the public bucket and removes the private copy.

alter table public.poll_options
  add column if not exists image_path text;

insert into storage.buckets (id, name, public)
values ('poll-images-private', 'poll-images-private', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('poll-images-public', 'poll-images-public', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Private bucket — path convention: {poll_id}/{option_id}.{ext}
-- Owner (while it's their poll) or an admin may read/write/delete.
-- ---------------------------------------------------------------------------
drop policy if exists "Owners manage their pending poll images" on storage.objects;

create policy "Owners manage their pending poll images"
  on storage.objects for all
  using (
    bucket_id = 'poll-images-private'
    and exists (
      select 1 from public.polls
      where polls.id::text = (storage.foldername(name))[1]
        and (
          polls.owner_id = auth.uid()
          or exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.is_admin
          )
        )
    )
  )
  with check (
    bucket_id = 'poll-images-private'
    and exists (
      select 1 from public.polls
      where polls.id::text = (storage.foldername(name))[1]
        and polls.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Public bucket — readable by everyone. No insert/update/delete policy is
-- defined for anon/authenticated on purpose: only the service-role client
-- (used server-side in the approve action) can write here.
-- ---------------------------------------------------------------------------
drop policy if exists "Public poll images are readable by everyone" on storage.objects;

create policy "Public poll images are readable by everyone"
  on storage.objects for select
  using (bucket_id = 'poll-images-public');
