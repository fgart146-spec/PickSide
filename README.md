# PickSide

둘 중 하나를 골라 투표하는 서비스. Next.js(App Router) + TypeScript + Tailwind CSS + shadcn/ui + Supabase(PostgreSQL) 기반.

## 기술 스택

- **Next.js 16** (App Router, Turbopack, Server Actions)
- **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui** (Base UI 기반 컴포넌트)
- **Supabase** — Auth + PostgreSQL(Postgres) + Row Level Security

## 폴더 구조

```
src/
  app/
    auth/actions.ts        # signIn / signUp / signOut 서버 액션
    login/page.tsx
    signup/page.tsx
    polls/
      actions.ts            # createPoll / castVote 서버 액션
      new/page.tsx           # 투표 생성 폼
      [id]/page.tsx           # 투표 상세 + 투표하기
    page.tsx                 # 투표 목록(홈)
    layout.tsx
  components/
    nav-bar.tsx
    ui/                       # shadcn/ui 컴포넌트
  lib/supabase/
    client.ts                 # 브라우저 클라이언트
    server.ts                 # 서버 컴포넌트/액션용 클라이언트
    middleware.ts              # 세션 갱신 헬퍼
    types.ts                   # Database 타입 정의 (스키마와 수동 동기화)
middleware.ts                  # 루트에서 Supabase 세션 갱신
supabase/migrations/           # PostgreSQL 스키마 마이그레이션 SQL
```

## 1. Supabase 프로젝트 준비

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 생성합니다.
2. **Project Settings → API**에서 `Project URL`, `anon public key`, `service_role key`를 확인합니다.
3. `.env.local`을 아래처럼 채웁니다(`.env.local.example` 참고):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

4. DB 스키마 적용: Supabase 대시보드의 **SQL Editor**에 `supabase/migrations/20260726000000_init.sql` 내용을 붙여넣고 실행하거나, [Supabase CLI](https://supabase.com/docs/guides/cli)를 사용합니다.

```bash
supabase link --project-ref <project-ref>
supabase db push
```

이 마이그레이션은 다음을 생성합니다:

- `profiles` — 회원가입 시 트리거로 자동 생성
- `polls` — 양자택일 질문
- `poll_options` — 질문당 옵션(2개)
- `votes` — 사용자당 투표 1건(poll_id, voter_id 유니크)
- 각 테이블의 Row Level Security 정책

5. **Authentication → Providers**에서 Email 로그인이 활성화되어 있는지 확인합니다. 개발 중에는 **Authentication → Settings**에서 "Confirm email"을 꺼두면 가입 즉시 로그인됩니다.

## 2. 로컬 개발

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인합니다. `.env.local`이 실제 Supabase 값으로 채워지기 전까지 홈 화면은 "Supabase에 연결할 수 없습니다" 안내를 보여줍니다(정상 동작).

## 3. 스크립트

```bash
npm run dev     # 개발 서버 (Turbopack)
npm run build   # 프로덕션 빌드
npm run start   # 프로덕션 서버 실행
npm run lint    # ESLint
```

## 4. shadcn/ui 컴포넌트 추가

```bash
npx shadcn@latest add <component-name>
```

## 5. 배포

Vercel 등에 배포 시 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 환경 변수를 프로젝트 설정에 등록해야 합니다.
