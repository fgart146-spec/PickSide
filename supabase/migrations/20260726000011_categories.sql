-- Fixed category list for polls.
do $$ begin
  create type public.poll_category as enum ('일상', '음식', '연애', '게임', '밸런스', '기타');
exception
  when duplicate_object then null;
end $$;

alter table public.polls
  add column if not exists category public.poll_category not null default '기타';

create index if not exists polls_category_idx on public.polls (category);
