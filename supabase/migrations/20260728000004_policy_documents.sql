-- Step 9 of the ops-review plan: admin-editable terms of service / privacy
-- policy content, backing the new /terms and /privacy pages + site footer.

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.policy_documents enable row level security;

grant select on public.policy_documents to anon, authenticated;
grant select, update on public.policy_documents to service_role;

create policy "Policy documents are public"
  on public.policy_documents for select
  using (true);

create policy "Admins can update policy documents"
  on public.policy_documents for update
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin));

insert into public.policy_documents (slug, title, body)
select * from (values
  ('terms', '이용약관', $$제1조 (목적)
이 약관은 PickSide(이하 "회사")가 제공하는 양자택일 투표 및 커뮤니티 서비스(이하 "서비스")의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 회사가 제공하는 투표 생성·참여, 커뮤니티 게시판 등 일체의 서비스를 의미합니다.
2. "회원"이란 이 약관에 동의하고 서비스를 이용하는 자를 의미합니다.
3. "게시물"이란 회원이 서비스 이용과 관련하여 작성한 투표, 댓글, 게시글, 이미지 등을 의미합니다.

제3조 (약관의 효력 및 변경)
1. 이 약관은 서비스 화면에 게시하여 공지함으로써 효력이 발생합니다.
2. 회사는 관련 법령을 위배하지 않는 범위에서 이 약관을 변경할 수 있으며, 변경 시 적용일자 및 변경사유를 명시하여 사전 공지합니다.

제4조 (서비스 이용)
1. 회원은 관련 법령과 이 약관, 회사의 공지사항 및 이용안내를 준수하여야 합니다.
2. 회사는 안정적인 서비스 제공을 위해 서비스의 전부 또는 일부를 수정, 중단할 수 있습니다.

제5조 (회원의 의무)
1. 회원은 타인의 권리를 침해하거나 명예를 훼손하는 게시물을 등록해서는 안 됩니다.
2. 회원은 허위 정보를 등록하거나 타인의 계정을 도용해서는 안 됩니다.
3. 회원이 등록한 게시물이 관련 법령 및 이 약관을 위반하는 경우, 회사는 해당 게시물을 삭제하거나 이용을 제한할 수 있습니다.

제6조 (게시물의 저작권)
1. 회원이 서비스 내에 게시한 게시물의 저작권은 해당 게시물을 작성한 회원에게 귀속됩니다.
2. 회사는 서비스의 운영, 개선 및 홍보를 위해 필요한 범위 내에서 게시물을 이용할 수 있습니다.

제7조 (면책조항)
1. 회사는 천재지변, 서비스 설비의 장애 등 불가항력적인 사유로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.
2. 회사는 회원이 게시한 정보, 자료의 신뢰성, 정확성에 대해 책임을 지지 않습니다.

부칙
이 약관은 2026년 7월 28일부터 적용됩니다.

※ 본 약관은 기본 템플릿이며, 관리자 페이지에서 서비스 운영 정책에 맞게 수정할 수 있습니다.$$),
  ('privacy', '개인정보처리방침', $$PickSide(이하 "회사")는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등 관련 법령을 준수하고 있습니다.

1. 수집하는 개인정보 항목
- 회원가입 시: 이메일 주소, 닉네임, 비밀번호(암호화 저장)
- 소셜 로그인 시: 소셜 계정에서 제공에 동의한 최소한의 정보(닉네임 등)
- 서비스 이용 과정에서 자동으로 생성되는 정보: 접속 IP, 쿠키, 서비스 이용 기록

2. 개인정보의 수집 및 이용 목적
- 회원 가입 의사 확인 및 서비스 제공
- 부정 이용 방지 및 비인가 사용 방지
- 공지사항 전달, 문의사항 처리

3. 개인정보의 보유 및 이용 기간
회사는 회원 탈퇴 시 또는 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 다만 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.

4. 개인정보의 제3자 제공
회사는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만 법령에 근거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 요청이 있는 경우는 예외로 합니다.

5. 이용자의 권리
이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제할 수 있으며 회원 탈퇴를 통해 개인정보 이용에 대한 동의를 철회할 수 있습니다.

6. 쿠키의 사용
서비스는 이용자에게 맞춤형 서비스를 제공하기 위해 쿠키를 사용할 수 있습니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다.

7. 개인정보 보호책임자
서비스 이용 중 개인정보 관련 문의사항은 관리자 문의 채널을 통해 접수해주시기 바랍니다.

부칙
이 개인정보처리방침은 2026년 7월 28일부터 적용됩니다.

※ 본 방침은 기본 템플릿이며, 관리자 페이지에서 실제 운영 정보(문의처 등)에 맞게 수정할 수 있습니다.$$)
) as seed(slug, title, body)
where not exists (select 1 from public.policy_documents p where p.slug = seed.slug);
