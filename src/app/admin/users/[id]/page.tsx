import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { unsuspendUser, banUser, unbanUser } from "@/app/admin/users/actions";
import { AdminSuspendForm } from "@/components/admin-suspend-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!adminProfile?.is_admin) {
    redirect("/");
  }

  const [
    { data: target },
    { data: polls },
    { data: comments },
    { data: communityPosts },
    { data: communityComments },
    { count: voteCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, username, is_admin, is_anonymous, suspended_until, banned_at, suspend_reason, created_at"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("polls")
      .select("id, question, status, created_at")
      .eq("owner_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("comments")
      .select("id, body, created_at, poll_id, polls(question)")
      .eq("author_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("community_posts")
      .select("id, title, board, created_at")
      .eq("author_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("community_comments")
      .select("id, body, created_at, post_id, community_posts(title, board)")
      .eq("author_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("votes").select("id", { count: "exact", head: true }).eq("voter_id", id),
  ]);

  if (!target) {
    notFound();
  }

  const isSuspended = Boolean(
    target.suspended_until && new Date(target.suspended_until) > new Date()
  );
  const isBanned = Boolean(target.banned_at);

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-8">
        <div>
          <Link href="/admin/users" className="text-sm text-muted-foreground underline underline-offset-4">
            ← 사용자 목록
          </Link>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{target.username}</h1>
            {target.is_admin && <Badge variant="outline">관리자</Badge>}
            {isBanned && <Badge variant="destructive">영구 정지</Badge>}
            {!isBanned && isSuspended && <Badge variant="secondary">일시 정지</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            가입일 {new Date(target.created_at).toLocaleString("ko-KR")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">계정 상태 관리</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {target.is_admin ? (
              <p className="text-sm text-muted-foreground">관리자 계정은 정지/차단할 수 없습니다.</p>
            ) : (
              <>
                {target.suspend_reason && (
                  <p className="text-sm text-muted-foreground">
                    최근 사유: {target.suspend_reason}
                  </p>
                )}
                {isBanned ? (
                  <form action={unbanUser.bind(null, target.id)}>
                    <Button type="submit" size="sm" variant="outline">
                      차단 해제
                    </Button>
                  </form>
                ) : (
                  <>
                    {isSuspended ? (
                      <form action={unsuspendUser.bind(null, target.id)}>
                        <p className="mb-2 text-sm text-muted-foreground">
                          {new Date(target.suspended_until!).toLocaleString("ko-KR")}까지 정지됨
                        </p>
                        <Button type="submit" size="sm" variant="outline">
                          정지 해제
                        </Button>
                      </form>
                    ) : (
                      <AdminSuspendForm userId={target.id} />
                    )}
                    <form action={banUser.bind(null, target.id)} className="flex flex-col gap-2 border-t pt-4">
                      <textarea
                        name="reason"
                        placeholder="영구 정지 사유 (선택)"
                        rows={2}
                        maxLength={300}
                        className="w-full resize-none rounded-md border bg-background px-2 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      />
                      <Button type="submit" size="sm" variant="destructive">
                        영구 정지
                      </Button>
                    </form>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            투표 참여 {voteCount ?? 0}회
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            작성한 투표 ({polls?.length ?? 0})
          </h2>
          {(!polls || polls.length === 0) && (
            <p className="text-sm text-muted-foreground">없습니다.</p>
          )}
          {polls?.map((poll) => (
            <Link key={poll.id} href={`/polls/${poll.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle className="text-base">{poll.question}</CardTitle>
                  <CardDescription>{poll.status}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            투표 댓글 ({comments?.length ?? 0})
          </h2>
          {(!comments || comments.length === 0) && (
            <p className="text-sm text-muted-foreground">없습니다.</p>
          )}
          {comments?.map((comment) => {
            const question =
              (comment as unknown as { polls: { question: string } | null }).polls
                ?.question ?? "삭제된 투표";
            return (
              <Link key={comment.id} href={`/polls/${comment.poll_id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="text-base">{question}</CardTitle>
                    <CardDescription>{comment.body}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            커뮤니티 게시글 ({communityPosts?.length ?? 0})
          </h2>
          {(!communityPosts || communityPosts.length === 0) && (
            <p className="text-sm text-muted-foreground">없습니다.</p>
          )}
          {communityPosts?.map((post) => (
            <Link key={post.id} href={`/community/${post.board}/${post.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle className="text-base">{post.title}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            커뮤니티 댓글 ({communityComments?.length ?? 0})
          </h2>
          {(!communityComments || communityComments.length === 0) && (
            <p className="text-sm text-muted-foreground">없습니다.</p>
          )}
          {communityComments?.map((comment) => {
            const post = (
              comment as unknown as {
                community_posts: { title: string; board: string } | null;
              }
            ).community_posts;
            return (
              <Link
                key={comment.id}
                href={post ? `/community/${post.board}/${comment.post_id}` : "#"}
              >
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="text-base">{post?.title ?? "삭제된 게시글"}</CardTitle>
                    <CardDescription>{comment.body}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
