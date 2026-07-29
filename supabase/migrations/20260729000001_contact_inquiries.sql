-- Contact/inquiry system, phase 1: /contact page (general/bug/ad/partnership
-- forms + business inquiry external link) and admin-side link editing + list
-- viewing. Later phases (per-type enable toggles, DB-managed extra channels,
-- status/notes/soft-delete admin actions) will ALTER these tables via new
-- migrations rather than touching this one.

-- ---------------------------------------------------------------------------
-- contact_settings — singleton row (id is always 1). Currently only holds
-- the business-inquiry external link fields the admin can edit in phase 1.
-- ---------------------------------------------------------------------------
create table if not exists public.contact_settings (
  id int primary key default 1,
  business_inquiry_enabled boolean not null default true,
  business_inquiry_label text not null default '카카오톡으로 비즈니스 문의하기',
  business_inquiry_description text not null default
    '광고, 제휴, 협업 등 빠른 상담이 필요한 경우 카카오톡으로 문의해주세요.',
  business_inquiry_url text not null default 'https://open.kakao.com/o/syfvvRei',
  business_inquiry_open_new_tab boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint contact_settings_singleton check (id = 1)
);

insert into public.contact_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.contact_settings enable row level security;

-- The public /contact page reads this via the service-role client (same
-- as other public-page config like home_sections/categories), so no
-- anon/authenticated SELECT grant is needed for that path. The admin
-- settings form uses the regular authenticated client though, so it needs
-- its own is_admin policy, same as contact_settings' sibling tables.
grant select, update on public.contact_settings to authenticated;
grant all on public.contact_settings to service_role;

drop policy if exists "Admins can view contact settings" on public.contact_settings;

create policy "Admins can view contact settings"
  on public.contact_settings for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

drop policy if exists "Admins can update contact settings" on public.contact_settings;

create policy "Admins can update contact settings"
  on public.contact_settings for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

-- ---------------------------------------------------------------------------
-- inquiries — general/bug/ad/partnership submissions. No RLS insert policy
-- for anon/authenticated on purpose: the public form always goes through a
-- Server Action (spam checks, validation) using the service-role client,
-- never a direct client-side insert. Admin reads use the regular
-- authenticated client though, same as reports/community_reports, so admin
-- pages just need an is_admin SELECT policy here.
-- ---------------------------------------------------------------------------
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('general', 'bug', 'ad', 'partnership')),
  status text not null default 'received'
    check (status in ('received', 'in_review', 'answered', 'on_hold', 'spam')),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  image_path text,
  user_id uuid references public.profiles (id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists inquiries_type_idx on public.inquiries (type);
create index if not exists inquiries_created_at_idx on public.inquiries (created_at desc);
create index if not exists inquiries_email_idx on public.inquiries (email);

alter table public.inquiries enable row level security;

grant select on public.inquiries to authenticated;
grant all on public.inquiries to service_role;

drop policy if exists "Admins can view inquiries" on public.inquiries;

create policy "Admins can view inquiries"
  on public.inquiries for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

-- ---------------------------------------------------------------------------
-- Private bucket for bug-report screenshots — admin-only reading via signed
-- URLs, matching the poll-images-private convention.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('inquiry-attachments', 'inquiry-attachments', false)
on conflict (id) do nothing;

drop policy if exists "Admins can read inquiry attachments" on storage.objects;

create policy "Admins can read inquiry attachments"
  on storage.objects for select
  using (
    bucket_id = 'inquiry-attachments'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );
