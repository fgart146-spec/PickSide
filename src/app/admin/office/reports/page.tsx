import { redirect } from "next/navigation";
import { ShieldIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { OfficeNav } from "@/components/office-nav";
import { OfficeImportForm } from "@/components/office-import-form";
import {
  generateReportRequest,
  applyReviewRecommendation,
  directResolveReview,
  dismissReview,
  holdReview,
} from "@/app/admin/office/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  REPORT_ACTIONS,
  REPORT_ACTION_LABEL,
  REPORT_REVIEW_STATUS_LABEL,
  RISK_LABEL,
  type ReportAction,
  type ReportReviewStatus,
  type RiskLevel,
} from "@/lib/ai/constants";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR");
}

export default async function ReportReviewerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
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

  const [{ data: reviews }, { data: queuedJob }] = await Promise.all([
    service
      .from("ai_report_reviews")
      .select(
        "id, source, report_id, target_type, reason, report_count, recommended_action, rationale, risk_level, confidence, requires_human_review, suggested_category, status, admin_decision, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100),
    service
      .from("ai_jobs")
      .select("id, request, created_at")
      .eq("worker", "report_review")
      .eq("status", "queued")
      .not("request", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = reviews ?? [];
  const pending = rows.filter((r) => r.status === "analyzed" || r.status === "admin_reviewing");
  const held = rows.filter((r) => r.status === "held");
  const done = rows.filter((r) => r.status === "resolved");

  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const doneStart = (page - 1) * PAGE_SIZE;
  const donePage = done.slice(doneStart, doneStart + PAGE_SIZE);
  const doneHasNext = done.length > doneStart + PAGE_SIZE;

  const pendingCount = (queuedJob?.request as { reports?: unknown[] } | null)?.reports?.length ?? 0;

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldIcon className="size-6 text-primary" />
            신고 검토관
          </h1>
          <p className="text-sm text-muted-foreground">
            신고와 대상 콘텐츠를 분석해 처리 방향을 <b>추천</b>합니다. 실제 반영은 아래 버튼으로
            관리자가 결정합니다.
          </p>
        </div>

        <OfficeNav active="/admin/office/reports" />

        {/* 작업 요청 생성 + 다운로드 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">작업 요청</CardTitle>
            <CardDescription>
              대기 중인 신고를 모아 Claude Code용 요청 JSON을 만듭니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <form action={generateReportRequest}>
              <Button type="submit" size="sm">
                작업 요청 생성
              </Button>
            </form>
            {queuedJob && (
              <a
                href={`/admin/office/request/${queuedJob.id}`}
                className="text-sm underline underline-offset-4"
              >
                요청 JSON 다운로드 (신고 {pendingCount}건)
              </a>
            )}
          </CardContent>
        </Card>

        <OfficeImportForm hint="Claude Code가 만든 신고 검토 결과(JSON)를 붙여넣거나 업로드하세요." />

        {/* 검토 필요 */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            검토 필요 ({pending.length})
          </h2>
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">검토할 추천이 없습니다.</p>
          )}
          {pending.map((r) => {
            const action = r.recommended_action as ReportAction;
            const isAdminReview = action === "admin_review";
            return (
              <Card key={r.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={action === "dismiss" || action === "keep" ? "secondary" : "destructive"}>
                      {REPORT_ACTION_LABEL[action]}
                    </Badge>
                    <Badge variant="outline">위험도 {RISK_LABEL[r.risk_level as RiskLevel]}</Badge>
                    <Badge variant="outline">신뢰도 {Math.round(Number(r.confidence) * 100)}%</Badge>
                    {r.requires_human_review && <Badge variant="outline">추가 확인 필요</Badge>}
                    <span className="text-xs text-muted-foreground">누적 신고 {r.report_count}회</span>
                  </div>
                  <CardTitle className="text-sm font-normal">
                    신고 사유: {r.reason ?? "-"}
                  </CardTitle>
                  {r.rationale && (
                    <CardDescription className="whitespace-pre-wrap">
                      AI 근거: {r.rationale}
                    </CardDescription>
                  )}
                  {action === "change_category" && r.suggested_category && (
                    <CardDescription>추천 카테고리: {r.suggested_category}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {!isAdminReview && (
                      <form action={applyReviewRecommendation.bind(null, r.id)}>
                        <Button type="submit" size="sm">추천 적용</Button>
                      </form>
                    )}
                    <form action={dismissReview.bind(null, r.id)}>
                      <Button type="submit" size="sm" variant="outline">기각</Button>
                    </form>
                    <form action={holdReview.bind(null, r.id)}>
                      <Button type="submit" size="sm" variant="ghost">보류</Button>
                    </form>
                  </div>
                  {/* 직접 처리 */}
                  <form
                    action={directResolveReview.bind(null, r.id)}
                    className="flex flex-wrap items-center gap-2 border-t pt-3"
                  >
                    <span className="text-xs text-muted-foreground">직접 처리:</span>
                    <select
                      name="action"
                      defaultValue={action}
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                    >
                      {REPORT_ACTIONS.map((a) => (
                        <option key={a} value={a}>
                          {REPORT_ACTION_LABEL[a]}
                        </option>
                      ))}
                    </select>
                    <input
                      name="note"
                      placeholder="메모(선택)"
                      className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                    />
                    <Button type="submit" size="sm" variant="secondary">적용</Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 보류 */}
        {held.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">보류 ({held.length})</h2>
            {held.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{REPORT_ACTION_LABEL[r.recommended_action as ReportAction]} · {r.reason ?? "-"}</span>
                <form action={applyReviewRecommendation.bind(null, r.id)}>
                  <Button type="submit" size="sm" variant="outline">추천 적용</Button>
                </form>
              </div>
            ))}
          </div>
        )}

        {/* 처리 완료 */}
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            처리 완료 ({done.length})
          </h2>
          {donePage.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm text-muted-foreground">
              <span>{r.admin_decision ?? REPORT_REVIEW_STATUS_LABEL[r.status as ReportReviewStatus]}</span>
              <span className="text-xs">{fmt(r.created_at)}</span>
            </div>
          ))}
          <Pagination
            page={page}
            hasNext={doneHasNext}
            makeHref={(p) => (p > 1 ? `/admin/office/reports?page=${p}` : "/admin/office/reports")}
          />
        </div>
      </div>
    </div>
  );
}
