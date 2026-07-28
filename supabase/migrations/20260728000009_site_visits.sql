-- Daily unique-visitor counter for the home page "오늘 접속자" stat. Not tied
-- to auth: most browsers never sign in (even anonymously — that only
-- happens on guest vote), so visitors are identified by a random id in a
-- long-lived first-party cookie, set by middleware on first request.

create table if not exists public.site_visits (
  visitor_id uuid not null,
  visit_date date not null,
  created_at timestamptz not null default now(),
  primary key (visitor_id, visit_date)
);

create index if not exists site_visits_visit_date_idx on public.site_visits (visit_date);

alter table public.site_visits enable row level security;

-- Middleware runs with the anon key, so it needs to be able to insert its
-- own visit row directly (no auth required to browse the site). Restricted
-- to today's date so a client can't backfill arbitrary historical rows.
-- The daily count itself is only ever read via the service-role client
-- (home-data.ts), so there is deliberately no select grant for anon here.
grant insert on public.site_visits to anon;
grant insert on public.site_visits to authenticated;
grant all on public.site_visits to service_role;

create policy "Anyone can record a visit for today"
  on public.site_visits for insert
  with check (visit_date = current_date);
