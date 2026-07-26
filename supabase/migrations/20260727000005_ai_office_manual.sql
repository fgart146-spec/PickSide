-- AI 직원 사무실 v2 — "반자동(semi-automatic)" 운영 구조.
--
-- 이 마이그레이션은 AI 직원 3종(신고 검토관 / 콘텐츠 기획자 / 통계 분석가)의
-- 산출물을 저장하는 전용 테이블과 공통 작업 로그(ai_jobs)를 추가합니다.
--
-- 핵심 원칙:
--   * AI(=Claude Code)는 실제 콘텐츠를 절대 직접 수정하지 않습니다. 추천/초안/
--     읽기 전용 리포트만 이 테이블들에 저장하고, 관리자가 관리자 페이지에서
--     승인/적용해야 실제 반영됩니다.
--   * 현재는 Claude API를 호출하지 않습니다. 서버는 "작업 요청"만 만들고,
--     Claude Code가 만든 결과 JSON을 서버가 검증한 뒤 이 테이블들에 넣습니다.
--   * 모든 삽입은 서버(server action / import)에서 service-role 클라이언트로
--     수행되어 RLS를 우회합니다. 관리자는 select/update 정책으로만 접근합니다.

-- ---------------------------------------------------------------------------
-- ai_jobs — 공통 작업 기록 (모든 AI 직원의 실행 이력)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  worker text not null check (worker in ('report_review', 'content_plan', 'analytics')),
  -- 작업 종류 라벨 (예: 'report_review', 'poll_draft', 'analytics_report')
  kind text not null,
  trigger text not null default 'manual' check (trigger in ('manual', 'cron', 'import')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  provider text not null default 'manual_claude_code',
  -- 생성된 작업 요청 스펙(다운로드용) + 입력 데이터 범위 설명
  request jsonb,
  input_range jsonb,
  result_count integer not null default 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  admin_confirmed boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_jobs_worker_status_idx
  on public.ai_jobs (worker, status, created_at desc);

-- ---------------------------------------------------------------------------
-- ai_report_reviews — 🛡️ 신고 검토관의 추천 (직접 처리 금지, 추천만)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_report_reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.ai_jobs (id) on delete set null,
  source text not null check (source in ('report', 'community_report')),
  report_id uuid not null,
  target_type text,
  target_id text,
  reason text,
  report_count integer not null default 1,
  -- AI 추천 조치
  recommended_action text not null check (recommended_action in (
    'dismiss',          -- 신고 기각
    'keep',             -- 콘텐츠 유지
    'hide',             -- 콘텐츠 숨김
    'delete',           -- 콘텐츠 삭제
    'reclassify_adult', -- 성인 콘텐츠로 재분류
    'change_category',  -- 카테고리 변경
    'warn_author',      -- 작성자 경고
    'admin_review'      -- 관리자 추가 검토 필요
  )),
  rationale text,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  confidence numeric(3, 2) not null default 0 check (confidence >= 0 and confidence <= 1),
  requires_human_review boolean not null default true,
  suggested_category text,
  -- 처리 상태: 분석 대기 / AI 분석 완료 / 관리자 검토 중 / 처리 완료 / 보류
  status text not null default 'analyzed' check (status in (
    'pending_analysis', 'analyzed', 'admin_reviewing', 'resolved', 'held'
  )),
  -- 관리자 최종 결정
  admin_decision text,
  admin_note text,
  admin_id uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- 동일 신고에 대한 중복 추천 저장 방지.
create unique index if not exists ai_report_reviews_subject_uniq
  on public.ai_report_reviews (source, report_id);

create index if not exists ai_report_reviews_status_idx
  on public.ai_report_reviews (status, created_at desc);

-- ---------------------------------------------------------------------------
-- ai_poll_drafts — ✍️ 콘텐츠 기획자의 투표 초안 (항상 pending 로 저장)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_poll_drafts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.ai_jobs (id) on delete set null,
  title text not null,
  option_a text not null,
  option_b text not null,
  description text,
  category text not null default '기타',
  tags text[] not null default '{}',
  image_prompt_a text,
  image_prompt_b text,
  cover_image_prompt text,
  adult_only boolean not null default false,
  featured boolean not null default false,
  expected_audience text,
  duplicate_risk text not null default 'low' check (duplicate_risk in ('low', 'medium', 'high')),
  rationale text,
  -- pending → approved → published, 또는 rejected / archived
  status text not null default 'pending' check (status in (
    'pending', 'approved', 'published', 'rejected', 'archived'
  )),
  -- 승인 시 생성되는 실제 polls 행 (그 전까지 polls 에는 아무것도 들어가지 않음)
  poll_id uuid references public.polls (id) on delete set null,
  -- 중복 저장 방지용 해시(제목+선택지 정규화)
  content_hash text,
  admin_id uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists ai_poll_drafts_hash_uniq
  on public.ai_poll_drafts (content_hash)
  where content_hash is not null;

create index if not exists ai_poll_drafts_status_idx
  on public.ai_poll_drafts (status, created_at desc);

-- ---------------------------------------------------------------------------
-- ai_analytics_reports — 📊 통계 분석가의 읽기 전용 리포트 (자동 저장 허용)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_analytics_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.ai_jobs (id) on delete set null,
  title text not null,
  report_type text not null default 'manual' check (report_type in (
    'manual', 'daily', 'weekly', 'monthly'
  )),
  period_start date,
  period_end date,
  metrics jsonb not null default '{}'::jsonb,
  summary text,
  details text,
  highlights jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  data_scope text,
  data_missing boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ai_analytics_reports_type_idx
  on public.ai_analytics_reports (report_type, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS + grants — 관리자만 읽고, 관리자만 검토/적용(update)할 수 있음.
-- 삽입은 서버측 service-role 클라이언트가 담당하므로 authenticated insert 정책은
-- 두지 않는다.
-- ---------------------------------------------------------------------------
alter table public.ai_jobs enable row level security;
alter table public.ai_report_reviews enable row level security;
alter table public.ai_poll_drafts enable row level security;
alter table public.ai_analytics_reports enable row level security;

grant select on public.ai_jobs to authenticated;
grant select, update on public.ai_report_reviews to authenticated;
grant select, update on public.ai_poll_drafts to authenticated;
grant select on public.ai_analytics_reports to authenticated;

grant all on public.ai_jobs to service_role;
grant all on public.ai_report_reviews to service_role;
grant all on public.ai_poll_drafts to service_role;
grant all on public.ai_analytics_reports to service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ai_jobs', 'ai_report_reviews', 'ai_poll_drafts', 'ai_analytics_reports'
  ]
  loop
    execute format(
      'create policy "Admins can view %1$s" on public.%1$s for select using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin));',
      t
    );
  end loop;
end $$;

-- 관리자만 검토 결정(update)을 내릴 수 있는 두 테이블.
create policy "Admins can update ai_report_reviews"
  on public.ai_report_reviews for update
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin));

create policy "Admins can update ai_poll_drafts"
  on public.ai_poll_drafts for update
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin));
