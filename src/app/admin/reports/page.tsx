import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveReport, dismissReport } from "@/app/admin/actions";
import { resolveCommunityReport, dismissCommunityReport } from "@/app/admin/community/actions";
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

type PollReportRow = {
  id: string;
  target_type: "poll" | "comment";
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  resolution_note: string | null;
  created_at: string;
  poll_id: string | null;
  comment_id: string | null;
  profiles: { username: string } | null;
  polls: { question: string } | null;
  comments: { body: string; poll_id: string; polls: { question: string } | null } | null;
};

type CommunityReportRow = {
  id: string;
  target_type: "post" | "comment";
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  resolution_note: string | null;
  created_at: string;
  post_id: string | null;
  comment_id: string | null;
  profiles: { username: string } | null;
  community_posts: { title: string; board: string } | null;
  community_comments: {
    body: string;
    post_id: string;
    community_posts: { title: string; board: string } | null;
  } | null;
};

type UnifiedReport = {
  id: string;
  source: "poll" | "community";
  typeLabel: string;
  label: string;
  href: string;
  extra: string | null;
  reporter: string;
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  resolutionNote: string | null;
  createdAt: string;
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
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

  const [{ data: pollReports }, { data: communityReports }] = await Promise.all([
    supabase
      .from("reports")
      .select(
        "id, target_type, reason, status, resolution_note, created_at, poll_id, comment_id, profiles(username), polls(question), comments(body, poll_id, polls(question))"
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("community_reports")
      .select(
        "id, target_type, reason, status, resolution_note, created_at, post_id, comment_id, profiles(username), community_posts(title, board), community_comments(body, post_id, community_posts(title, board))"
      )
      .order("created_at", { ascending: true }),
  ]);

  const pollRows = (pollReports ?? []) as unknown as PollReportRow[];
  const communityRows = (communityReports ?? []) as unknown as CommunityReportRow[];

  const unified: UnifiedReport[] = [
    ...pollRows.map((r) => {
      if (r.target_type === "poll") {
        return {
          id: r.id,
          source: "poll" as const,
          typeLabel: "투표",
          label: r.polls?.question ?? "삭제된 투표",
          href: `/polls/${r.poll_id}`,
          extra: null,
          reporter: r.profiles?.username ?? "알 수 없음",
          reason: r.reason,
          status: r.status,
          resolutionNote: r.resolution_note,
          createdAt: r.created_at,
        };
      }
      return {
        id: r.id,
        source: "poll" as const,
        typeLabel: "투표 댓글",
        label: r.comments?.polls?.question ?? "삭제된 투표",
        href: `/polls/${r.comments?.poll_id ?? ""}`,
        extra: r.comments?.body ?? "삭제된 댓글",
        reporter: r.profiles?.username ?? "알 수 없음",
        reason: r.reason,
        status: r.status,
        resolutionNote: r.resolution_note,
        createdAt: r.created_at,
      };
    }),
    ...communityRows.map((r) => {
      if (r.target_type === "post") {
        return {
          id: r.id,
          source: "community" as const,
          typeLabel: "커뮤니티 게시글",
          label: r.community_posts?.title ?? "삭제된 게시글",
          href: `/community/${r.community_posts?.board ?? ""}/${r.post_id}`,
          extra: null,
          reporter: r.profiles?.username ?? "알 수 없음",
          reason: r.reason,
          status: r.status,
          resolutionNote: r.resolution_note,
          createdAt: r.created_at,
        };
      }
      return {
        id: r.id,
        source: "community" as const,
        typeLabel: "커뮤니티 댓글",
        label: r.community_comments?.community_posts?.title ?? "삭제된 게시글",
        href: `/community/${r.community_comments?.community_posts?.board ?? ""}/${r.community_comments?.post_id ?? ""}`,
        extra: r.community_comments?.body ?? "삭제된 댓글",
        reporter: r.profiles?.username ?? "알 수 없음",
        reason: r.reason,
        status: r.status,
        resolutionNote: r.resolution_note,
        createdAt: r.created_at,
      };
    }),
  ].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  const pending = unified.filter((r) => r.status === "pending");
  const handled = unified.filter((r) => r.status !== "pending");

  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const handledStart = (page - 1) * PAGE_SIZE;
  const handledPage = handled.slice(handledStart, handledStart + PAGE_SIZE);
  const handledHasNext = handled.length > handledStart + PAGE_SIZE;

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">신고 처리</h1>
          <p className="text-sm text-muted-foreground">
            투표·투표 댓글·커뮤니티 게시글·커뮤니티 댓글 신고를 한 곳에서 처리합니다.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            처리 대기 ({pending.length})
          </h2>
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">대기 중인 신고가 없습니다.</p>
          )}
          {pending.map((report) => (
            <Card key={`${report.source}-${report.id}`}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{report.typeLabel}</Badge>
                  <CardTitle className="text-base">
                    <Link href={report.href} className="underline underline-offset-4">
                      {report.label}
                    </Link>
                  </CardTitle>
                </div>
                {report.extra && (
                  <CardDescription className="whitespace-pre-wrap">
                    신고된 내용: {report.extra}
                  </CardDescription>
                )}
                <CardDescription>
                  신고자: {report.reporter} · 사유: {report.reason}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={
                    report.source === "poll"
                      ? resolveReport.bind(null, report.id)
                      : resolveCommunityReport.bind(null, report.id)
                  }
                  className="flex flex-col gap-2"
                >
                  <textarea
                    name="reason"
                    placeholder="처리 사유 (선택)"
                    maxLength={300}
                    rows={2}
                    className="w-full resize-none rounded-md border bg-background px-2 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">
                      처리 완료
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      formAction={
                        report.source === "poll"
                          ? dismissReport.bind(null, report.id)
                          : dismissCommunityReport.bind(null, report.id)
                      }
                    >
                      기각
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            처리 완료 ({handled.length})
          </h2>
          {handledPage.map((report) => (
            <Card key={`${report.source}-${report.id}`}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="outline">{report.typeLabel}</Badge>
                  </div>
                  <CardTitle className="text-base">{report.label}</CardTitle>
                  <CardDescription>사유: {report.reason}</CardDescription>
                  {report.resolutionNote && (
                    <CardDescription>처리 사유: {report.resolutionNote}</CardDescription>
                  )}
                </div>
                <Badge variant={report.status === "resolved" ? "default" : "secondary"}>
                  {report.status === "resolved" ? "처리 완료" : "기각됨"}
                </Badge>
              </CardHeader>
            </Card>
          ))}

          <Pagination
            page={page}
            hasNext={handledHasNext}
            makeHref={(p) => (p > 1 ? `/admin/reports?page=${p}` : "/admin/reports")}
          />
        </div>
      </div>
    </div>
  );
}
