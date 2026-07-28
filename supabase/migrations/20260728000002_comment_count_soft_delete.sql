-- Step 4 of the ops-review plan: data aggregation consistency.
--
-- Bug found: polls.comment_count (migration 20260727000007) is only kept in
-- sync by an AFTER INSERT OR DELETE trigger on comments. Admin moderation
-- soft-deletes a comment via `UPDATE comments SET deleted_at = now()`
-- (src/app/comments/actions.ts) — that UPDATE never fires the trigger, so
-- comment_count stays inflated forever after an admin hides a comment, while
-- the poll detail page (which live-counts comments with deleted_at is null)
-- correctly shows the lower number. Same for restoring from trash.
--
-- Fix: react to UPDATE OF deleted_at too, treating a NULL->NOT NULL
-- transition as a removal and NOT NULL->NULL as a re-addition. A hard DELETE
-- only decrements if the row was still visible (not already soft-deleted),
-- so an already-hidden comment being permanently deleted from the trash
-- doesn't double-decrement.

create or replace function public.bump_poll_comment_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      update public.polls set comment_count = comment_count + 1 where id = new.poll_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.deleted_at is null then
      update public.polls set comment_count = greatest(comment_count - 1, 0) where id = old.poll_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      update public.polls set comment_count = greatest(comment_count - 1, 0) where id = new.poll_id;
    elsif old.deleted_at is not null and new.deleted_at is null then
      update public.polls set comment_count = comment_count + 1 where id = new.poll_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists comments_count_trg on public.comments;
create trigger comments_count_trg
  after insert or update of deleted_at or delete on public.comments
  for each row execute function public.bump_poll_comment_count();

-- Backfill: recompute every poll's comment_count from live data so counts
-- that already drifted (comments soft-deleted before this fix) self-correct.
update public.polls p set
  comment_count = coalesce(
    (select count(*) from public.comments c where c.poll_id = p.id and c.deleted_at is null),
    0
  );
