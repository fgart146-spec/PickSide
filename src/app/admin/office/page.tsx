import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { OfficeNav } from "@/components/office-nav";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AI_WORKER_META,
  JOB_STATUS_LABEL,
  type AiWorker,
  type JobStatus,
} from "@/lib/ai/constants";

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ko-KR") : "-";
}

const head = { count: "exact" as const, head: true };

export default async function AiDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/");

  const service = createServiceClient();
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const todayIso = startToday.toISOString();

  const [
    reviewsPending,
    reviewsResolved,
    draftsPending,
    draftsToday,
    latestReport,
    recentJobs,
  ] = await Promise.all([
    service
      .from("ai_report_reviews")
      .select("*", head)
      .in("status", ["pending_analysis", "analyzed", "admin_reviewing"]),
    service.from("ai_report_reviews").select("*", head).eq("status", "resolved"),
    service.from("ai_poll_drafts").select("*", head).eq("status", "pending"),
    service.from("ai_poll_drafts").select("*", head).gte("created_at", todayIso),
    service
      .from("ai_analytics_reports")
      .select("id, title, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("ai_jobs")
      .select("id, worker, kind, status, error, finished_at, created_at, result_count")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const lastJob = recentJobs.data?.[0] ?? null;
  const lastError = (recentJobs.data ?? []).find((j) => j.status === "failed");

  const stats = [
    { label: "🛡️ 신고 검토 대기", value: reviewsPending.count ?? 0, href: "/admin/office/reports" },
    { label: "🛡️ 신고 검토 완료", value: reviewsResolved.count ?? 0, href: "/admin/office/reports" },
    { label: "✍️ 초안 검토 대기", value: draftsPending.count ?? 0, href: "/admin/office/drafts" },
    { label: "✍️ 오늘 생성 초안", value: draftsToday.count ?? 0, href: "/admin/office/drafts" },
  ];

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI 직원 사무실</h1>
          <p className="text-sm text-muted-foreground">
            AI 직원(Claude Code)은 추천·초안·리포트만 만들고, 실제 반영은 관리자가 승인합니다.
            현재 제공자는 <code className="rounded bg-muted px-1">ManualClaudeCodeProvider</code> 입니다.
          </p>
        </div>

        <OfficeNav active="/admin/office" />

        {/* 핵심 카운트 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <Link key={s.label} href={s.href}>
              <Card className="transition-colors hover:bg-accent/40">
                <CardHeader className="p-4">
                  <CardDescription className="text-xs">{s.label}</CardDescription>
                  <CardTitle className="text-2xl">{s.value}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        {/* 직원 소개 */}
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(AI_WORKER_META) as AiWorker[]).map((w) => {
            const meta = AI_WORKER_META[w];
            return (
              <Link key={w} href={meta.href}>
                <Card className="h-full transition-colors hover:bg-accent/40">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base">
                      {meta.emoji} {meta.name}
                    </CardTitle>
                    <CardDescription className="text-xs">{meta.job}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* 최근 통계 리포트 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 통계 리포트</CardTitle>
          </CardHeader>
          <CardContent>
            {latestReport.data ? (
              <Link
                href="/admin/office/analytics"
                className="block text-sm underline-offset-4 hover:underline"
              >
                <span className="font-medium">{latestReport.data.title}</span>
                <span className="block text-muted-foreground">
                  {latestReport.data.summary}
                </span>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">아직 생성된 리포트가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        {/* 최근 작업 기록 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">최근 작업 기록</h2>
            <span className="text-xs text-muted-foreground">
              마지막 실행: {fmt(lastJob?.created_at ?? null)}
            </span>
          </div>
          {lastError && (
            <p className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              최근 오류: {lastError.error ?? "알 수 없는 오류"} ({fmt(lastError.finished_at)})
            </p>
          )}
          {(recentJobs.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">작업 이력이 없습니다.</p>
          )}
          {(recentJobs.data ?? []).map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex flex-col">
                <span>
                  {AI_WORKER_META[job.worker as AiWorker]?.emoji} {job.kind}
                </span>
                <span className="text-xs text-muted-foreground">{fmt(job.created_at)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">결과 {job.result_count}</span>
                <Badge
                  variant={
                    job.status === "failed"
                      ? "destructive"
                      : job.status === "completed"
                      ? "default"
                      : "secondary"
                  }
                >
                  {JOB_STATUS_LABEL[job.status as JobStatus] ?? job.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
