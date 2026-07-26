# PickSide 배포 가이드

Vercel + Supabase(기존 프로젝트 그대로) + 이메일 인증(SMTP) 기준입니다.
아래 순서대로 하면 다른 사람이 인터넷에서 접속해 쓸 수 있습니다.

---

## 0. 준비물

- **GitHub 계정** (코드 보관 + Vercel 연동)
- **Vercel 계정** (https://vercel.com — GitHub로 가입 가능)
- **기존 Supabase 프로젝트** (지금 `.env.local`에서 쓰던 그것)
- **SMTP 제공자** (이메일 발송용 — [Resend](https://resend.com) 무료 티어 추천)

> 지금은 Claude API를 쓰지 않으므로 `ANTHROPIC_API_KEY`는 **필요 없습니다.**

---

## 1. GitHub에 코드 올리기

이미 로컬 커밋은 만들어져 있습니다(브랜치 `main`). GitHub에 빈 저장소를 만든 뒤:

```bash
git remote add origin https://github.com/<사용자명>/<저장소명>.git
git push -u origin main
```

> `.env.local`은 `.gitignore`에 의해 **커밋되지 않습니다**(비밀키 안전). 그래서 배포 환경엔 아래 2단계에서 환경변수를 따로 넣어줍니다.

---

## 2. Vercel 배포

1. Vercel → **Add New → Project** → 방금 만든 GitHub 저장소 **Import**.
2. Framework Preset: **Next.js** (자동 감지됨).
3. **Environment Variables**에 4개 등록 (`.env.local`에 있는 값 그대로):

   | 이름 | 값 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon public key) |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role key — 비공개!) |
   | `CRON_SECRET` | `.env.local`의 값과 동일하게 |

4. **Deploy**. 끝나면 `https://<프로젝트>.vercel.app` 주소가 나옵니다. 이게 배포 도메인입니다.

> 이후 `git push` 할 때마다 Vercel이 자동 재배포합니다.

---

## 3. Supabase 프로덕션 설정 (기존 프로젝트)

### 3-1. 마이그레이션 전부 적용 확인
`supabase/migrations/` 폴더의 SQL 24개가 **모두** 적용돼 있어야 합니다. 확인/적용:

- Supabase CLI 사용 시:
  ```bash
  supabase link --project-ref <프로젝트-ref>
  supabase db push
  ```
- 또는 SQL Editor에서 아직 안 돌린 파일 내용을 순서대로 붙여넣어 실행.
  (최근 추가분: `20260727000005_ai_office_manual.sql`, `20260727000006_ai_draft_images.sql`)

### 3-2. 스토리지 버킷 확인
아래 버킷이 존재해야 합니다. 없으면 Storage에서 생성:

| 버킷 | 공개 여부 |
|---|---|
| `poll-images-private` | Private |
| `poll-images-public` | Public |
| `community-images` | Public |
| `site-content-images` | Public |

### 3-3. Auth 도메인 설정
**Authentication → URL Configuration**:
- **Site URL**: `https://<프로젝트>.vercel.app`
- **Redirect URLs**에 추가: `https://<프로젝트>.vercel.app/auth/callback`
  (로컬 개발용 `http://localhost:3000/auth/callback`도 함께 두면 편함)

---

## 4. 이메일 인증 + SMTP (실사용자 필수)

지금은 개발 편의로 이메일 확인이 꺼져 있습니다. 실사용자를 받으려면:

1. **Resend** 가입 → 도메인 인증(또는 테스트용 발신 주소 확보) → SMTP 자격 증명 발급.
2. Supabase **Authentication → Emails → SMTP Settings**에서 **Custom SMTP** 켜고 입력:
   - Host / Port / Username / Password (Resend에서 제공)
   - Sender email / Sender name
3. **Authentication → Providers → Email**에서 **"Confirm email" ON**.

> SMTP 없이 Supabase 기본 메일은 하루 발송량 제한이 커서 실서비스엔 부적합합니다.
>
> ⚠️ 이메일 확인을 켜기 **전에** 가입한 계정들은 미확인 상태로 남을 수 있으니, 오픈 전 테스트 계정은 정리하세요.

---

## 5. Cron (자동 통계/요청)

`vercel.json`에 매일 00:00(UTC) 실행되는 cron이 이미 설정돼 있습니다
(`/api/cron/ai-office`). Vercel 환경변수 `CRON_SECRET`만 있으면 자동 동작합니다.
이 cron은 **모델을 호출하지 않고**, 통계 리포트 생성 + 신고/콘텐츠 작업 요청 큐잉만 합니다.

---

## 6. 첫 관리자 계정

1. 배포된 사이트에서 회원가입(이메일 확인까지 완료).
2. Supabase **SQL Editor**에서 그 계정을 관리자로 승격:
   ```sql
   update public.profiles
   set is_admin = true
   where id = (select id from auth.users where email = '관리자이메일@example.com');
   ```
3. 이제 상단 "관리자" 메뉴 + `/admin/office`(AI 직원 관리) 접근 가능.

---

## 7. 배포 후 점검

- [ ] 회원가입 → **확인 이메일 수신** 확인
- [ ] 로그인 → 투표 생성 → `/admin/polls`에서 승인 → 홈에 노출
- [ ] `/admin/office/drafts`에서 초안 가져오기/승인 동작
- [ ] `/admin/office/analytics`에서 리포트 생성
- [ ] 이미지 업로드/노출 확인

---

## 참고 / 주의

- **테스트 데이터**: 현재 모든 투표가 소프트 삭제(휴지통) 상태입니다. 영구 삭제는
  `/admin/trash`에서 직접 진행하세요. 오픈용 콘텐츠는 새로 게시해야 합니다.
- **카카오 로그인**: GoTrue 제약으로 현재 막혀 있습니다. 소셜 로그인이 필요하면
  Google 사용을 권장합니다(Supabase Auth → Providers → Google + Vercel 도메인 등록).
- **AI 직원 사무실**: 현재 제공자는 `ManualClaudeCodeProvider`(수동)입니다. 나중에
  자동화하려면 `src/lib/ai/provider.ts`의 `ClaudeApiProvider`를 구현하고
  `AI_PROVIDER=claude_api` 환경변수만 바꾸면 됩니다. 화면/승인/로그/스키마는 그대로.
