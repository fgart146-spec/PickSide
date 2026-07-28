import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteComment } from "@/app/comments/actions";
import { Button } from "@/components/ui/button";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminCommentsPage({
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

  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const from = (page - 1) * PAGE_SIZE;

  const { data } = await supabase
    .from("comments")
    .select("id, body, created_at, poll_id, profiles!comments_author_id_fkey(username), polls(question)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE);

  const rows = data ?? [];
  const hasNext = rows.length > PAGE_SIZE;
  const comments = rows.slice(0, PAGE_SIZE);

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">전체 투표 댓글</h1>
          <p className="text-sm text-muted-foreground">
            댓글을 최신순으로 표시합니다. 삭제하면 휴지통으로 이동합니다.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {comments?.map((comment) => {
            const author =
              (comment as unknown as { profiles: { username: string } | null }).profiles
                ?.username ?? "알 수 없음";
            const pollQuestion =
              (comment as unknown as { polls: { question: string } | null }).polls
                ?.question ?? "삭제된 투표";
            return (
              <Card key={comment.id}>
                <CardHeader>
                  <CardTitle className="text-sm">
                    <Link href={`/polls/${comment.poll_id}`} className="underline underline-offset-4">
                      {pollQuestion}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {author} · {comment.body}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={deleteComment.bind(null, comment.poll_id, comment.id)}>
                    <Button type="submit" size="sm" variant="outline">
                      삭제
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground">댓글이 없습니다.</p>
          )}
        </div>

        <Pagination
          page={page}
          hasNext={hasNext}
          makeHref={(p) => (p > 1 ? `/admin/comments?page=${p}` : "/admin/comments")}
        />
      </div>
    </div>
  );
}
