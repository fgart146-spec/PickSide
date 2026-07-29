-- Contact system phase 2: full settings CMS (per-type enable toggles,
-- contact email, page intro text), admin-managed extra contact channels
-- (DB-driven, not a fixed array), and inquiry moderation (status/note/
-- soft-delete/restore/permanent-delete). Builds on
-- 20260729000001_contact_inquiries.sql without altering its statements.

-- ---------------------------------------------------------------------------
-- contact_settings — new columns for the fuller settings CMS.
-- ---------------------------------------------------------------------------
alter table public.contact_settings
  add column if not exists page_enabled boolean not null default true,
  add column if not exists general_enabled boolean not null default true,
  add column if not exists bug_enabled boolean not null default true,
  add column if not exists ad_enabled boolean not null default true,
  add column if not exists partnership_enabled boolean not null default true,
  add column if not exists contact_email text,
  add column if not exists intro_text text;

-- ---------------------------------------------------------------------------
-- inquiries — track the submitter's IP for a lightweight daily rate cap
-- (on top of the phase-1 per-email cooldown + honeypot).
-- ---------------------------------------------------------------------------
alter table public.inquiries
  add column if not exists ip_address text;

create index if not exists inquiries_ip_created_idx on public.inquiries (ip_address, created_at);

-- ---------------------------------------------------------------------------
-- contact_channels — admin-managed extra contact links (카카오톡, 이메일,
-- 인스타그램, 디스코드, 네이버 톡톡, 기타...), separate from the dedicated
-- business-inquiry fields above. Read via service-role from the public
-- /contact page and written via service-role from admin actions (same
-- pattern as categories/community_boards), so no anon/authenticated grant.
-- ---------------------------------------------------------------------------
create table if not exists public.contact_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  button_label text not null,
  description text,
  url text not null,
  icon text not null default 'link',
  is_visible boolean not null default true,
  sort_order int not null default 0,
  open_new_tab boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_channels_sort_order_idx on public.contact_channels (sort_order);

alter table public.contact_channels enable row level security;

grant all on public.contact_channels to service_role;
