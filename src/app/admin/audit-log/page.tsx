import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/pagination";
import { escapeLike, quoteOrValue } from "@/lib/search";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuditRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  created_at: string;
  profiles: { username: string } | null;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "(없음)";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

/** Only shows keys whose value actually changed between before/after. */
function ChangedFields({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!before && !after) return null;

  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changed = [...keys].filter(
    (key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])
  );

  if (changed.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 rounded-md border bg-muted/30 p-2 text-xs">
      {changed.map((key) => (
        <div key={key} className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-muted-foreground">{key}</span>
          <span className="text-destructive/80 line-through">
            {before ? formatValue(before[key]) : "(신규)"}
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="text-foreground">{after ? formatValue(after[key]) : "(삭제됨)"}</span>
        </div>
      ))}
    </div>
  );
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/");
  }

  const { q, page: pageParam } = await searchParams;
  const query = q?.trim() ?? "";
  const page = parsePage(pageParam);
  const from = (page - 1) * PAGE_SIZE;

  let logQuery = supabase
    .from("audit_log")
    .select(
      "id, action, target_type, target_id, reason, before_value, after_value, created_at, profiles!audit_log_admin_id_fkey(username)"
    )
    .order("created_at", { ascending: false });

  if (query) {
    const pattern = quoteOrValue(`%${escapeLike(query)}%`);
    logQuery = logQuery.or(
      `action.ilike.${pattern},target_type.ilike.${pattern},reason.ilike.${pattern}`
    );
  }

  const { data, error } = await logQuery.range(from, from + PAGE_SIZE);
  const rows = ((data as unknown as AuditRow[]) ?? []);
  const hasNext = rows.length > PAGE_SIZE;
  const entries = rows.slice(0, PAGE_SIZE);

  const makeHref = (p: number) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/admin/audit-log?${qs}` : "/admin/audit-log";
  };

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">감사 로그</h1>
          <p className="text-sm text-muted-foreground">
            관리자 작업 내역을 최신순으로 표시합니다. 작업 종류·대상·사유로 검색할 수 있어요.
          </p>
        </div>

        <form className="flex gap-2">
          <Input name="q" placeholder="예: category.update, poll, 정지" defaultValue={query} />
          <Button type="submit" variant="outline">
            검색
          </Button>
        </form>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive text-base">
                불러오는 중 오류가 발생했습니다
              </CardTitle>
              <CardDescription>{error.message}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{entry.action}</Badge>
                  <CardTitle className="text-sm font-normal text-muted-foreground">
                    {entry.target_type}
                    {entry.target_id ? ` · ${entry.target_id}` : ""}
                  </CardTitle>
                </div>
                <CardDescription>
                  {entry.profiles?.username ?? "알 수 없음"} ·{" "}
                  {new Date(entry.created_at).toLocaleString("ko-KR")}
                </CardDescription>
              </CardHeader>
              {(entry.reason || entry.before_value || entry.after_value) && (
                <CardContent className="flex flex-col gap-2">
                  {entry.reason && <p className="text-sm">{entry.reason}</p>}
                  <ChangedFields before={entry.before_value} after={entry.after_value} />
                </CardContent>
              )}
            </Card>
          ))}
          {entries.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">기록이 없습니다.</p>
          )}
        </div>

        <Pagination page={page} hasNext={hasNext} makeHref={makeHref} />
      </div>
    </div>
  );
}
