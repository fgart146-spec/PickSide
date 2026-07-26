-- Trigram indexes so ILIKE '%term%' searches over poll questions and
-- option labels stay index-backed instead of falling back to a full
-- sequential scan as the tables grow.
create extension if not exists pg_trgm;

create index if not exists polls_question_trgm_idx
  on public.polls using gin (question gin_trgm_ops);

create index if not exists poll_options_label_trgm_idx
  on public.poll_options using gin (label gin_trgm_ops);
