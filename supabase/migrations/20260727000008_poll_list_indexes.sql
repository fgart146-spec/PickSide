-- Indexes backing the paginated main poll list.
--
-- The homepage now orders published polls by (is_pinned, <sort>) and pulls a
-- single page via range(). These partial indexes cover the two hot sort
-- paths (latest / popular) restricted to the published, non-deleted rows the
-- list actually scans, plus a comment_count index for the "댓글순" sort.

create index if not exists polls_comment_count_idx
  on public.polls (comment_count desc);

create index if not exists polls_pub_pinned_created_idx
  on public.polls (is_pinned desc, created_at desc)
  where status = 'published' and deleted_at is null;

create index if not exists polls_pub_pinned_votes_idx
  on public.polls (is_pinned desc, vote_count desc)
  where status = 'published' and deleted_at is null;
