-- Fix: poll_options was missing UPDATE grant/policy, so createPoll could
-- upload an image to storage but not save its image_path afterwards.
grant update on public.poll_options to authenticated;

drop policy if exists "Poll owners can update their poll's options" on public.poll_options;

create policy "Poll owners can update their poll's options"
  on public.poll_options for update
  using (
    exists (
      select 1 from public.polls
      where polls.id = poll_options.poll_id and polls.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.polls
      where polls.id = poll_options.poll_id and polls.owner_id = auth.uid()
    )
  );
