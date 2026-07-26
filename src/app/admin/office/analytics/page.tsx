import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { OfficeNav } from "@/components/office-nav";
import { OfficeImportForm } from "@/components/office-import-form";
import { generateAnalytics } from "@/app/admin/office/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  REPORT_TYPES,
  REPORT_TYPE_LABEL,
  type AnalyticsReportType,
} from "@/lib/ai/constants";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR");
}

type ReportRow = {
  id: string;
  title: string;
  report_type: string;
  period_start: string | null;
  period_end: string | null;
  metrics: Record<string, unknown> | null;
  summary: string | null;
  details: string | null;
  highlights: string[] | null;
  warnings: string[] | null;
  recommendations: string[] | null;
  data_scope: string | null;
  data_missing: boolean;
  created_at: string;
};

export default async function AnalyticsPage() {
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
  const { data: reports } = await service
    .from("ai_analytics_reports")
    .select(
      "id, title, report_type, period_start, period_end, metrics, summary, details, highlights, warnings, recommendations, data_scope, data_missing, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (reports ?? []) as unknown as ReportRow[];

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">📊 통계 분석가</h1>
          <p className="text-sm text-muted-foreground">
            실제 수집된 데이터만으로 <b>읽기 전용</b> 리포트를 만듭니다. 수집하지 않는 지표는
            임의로 만들지 않고 경고로 표시합니다.
          </p>
        </div>

        <OfficeNav active="/admin/office/analytics" />

        {/* 리포트 생성 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">리포트 생성</CardTitle>
            <CardDescription>주기를 선택해 즉시 생성합니다. (승인 없이 자동 저장)</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={generateAnalytics} className="flex flex-wrap items-center gap-2">
              <select
                name="reportType"
                defaultValue="manual"
                className="rounded-md border bg-background px-2 py-1 text-sm"
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {REPORT_TYPE_LABEL[t as AnalyticsReportType]}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm">생성</Button>
            </form>
          </CardContent>
        </Card>

        <OfficeImportForm hint="Claude Code가 쓴 리포트 요약(JSON, taskType: analytics_report)을 가져올 수 있습니다." />

        {/* 리포트 목록 */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">리포트 ({rows.length})</h2>
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">아직 생성된 리포트가 없습니다.</p>
          )}
          {rows.map((r) => {
            const m = (r.metrics ?? {}) as Record<string, number | Record<string, number>>;
            return (
              <Card key={r.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {REPORT_TYPE_LABEL[r.report_type as AnalyticsReportType] ?? r.report_type}
                    </Badge>
                    <CardTitle className="text-base">{r.title}</CardTitle>
                  </div>
                  {r.summary && (
                    <CardDescription className="whitespace-pre-wrap">{r.summary}</CardDescription>
                  )}
                  <CardDescription className="text-xs">
                    {r.period_start} ~ {r.period_end} · 생성 {fmt(r.created_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <details>
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      상세 보기
                    </summary>
                    <div className="mt-3 flex flex-col gap-3 text-sm">
                      {/* 핵심 지표 */}
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {typeof m.published_polls === "number" && (
                          <Metric label="게시 투표" value={m.published_polls} />
                        )}
                        {typeof m.pending_polls === "number" && (
                          <Metric label="대기 투표" value={m.pending_polls} />
                        )}
                        {typeof m.total_votes === "number" && (
                          <Metric label="총 투표참여" value={m.total_votes} />
                        )}
                        {typeof m.total_comments === "number" && (
                          <Metric label="총 댓글" value={m.total_comments} />
                        )}
                        {typeof m.pending_reports === "number" && (
                          <Metric label="대기 신고" value={m.pending_reports} />
                        )}
                        {typeof m.new_users_today === "number" && (
                          <Metric label="오늘 신규가입" value={m.new_users_today} />
                        )}
                      </div>

                      {(r.highlights?.length ?? 0) > 0 && (
                        <Section title="핵심 요약" items={r.highlights ?? []} />
                      )}
                      {(r.warnings?.length ?? 0) > 0 && (
                        <Section title="⚠️ 확인 필요" items={r.warnings ?? []} tone="warn" />
                      )}
                      {(r.recommendations?.length ?? 0) > 0 && (
                        <Section title="개선 제안" items={r.recommendations ?? []} />
                      )}

                      {r.data_missing && (
                        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-1 text-xs text-amber-600 dark:text-amber-400">
                          일부 지표(방문자·이탈률·기기 비율·광고 등)는 현재 수집하지 않아 리포트에서 제외되었습니다.
                        </p>
                      )}
                      {r.data_scope && (
                        <p className="text-xs text-muted-foreground">데이터 범위: {r.data_scope}</p>
                      )}
                    </div>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-2 py-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone?: "warn";
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <ul className="mt-1 list-inside list-disc space-y-0.5">
        {items.map((it, i) => (
          <li
            key={i}
            className={tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""}
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
