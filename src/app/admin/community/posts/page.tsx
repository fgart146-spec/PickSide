import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deletePost } from "@/app/community/actions";
import { BOARD_LABEL, type CommunityBoard } from "@/lib/community-boards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminCommunityPostsPage() {
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

  const { data: posts } = await supabase
    .from("community_posts")
    .select("id, title, board, created_at, profiles!community_posts_author_id_fkey(username)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">전체 커뮤니티 게시글</h1>
          <p className="text-sm text-muted-foreground">
            최근 200개의 게시글을 표시합니다.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {posts?.map((post) => {
            const author =
              (post as unknown as { profiles: { username: string } | null }).profiles
                ?.username ?? "알 수 없음";
            const board = post.board as CommunityBoard;
            return (
              <Card key={post.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <div className="mb-1">
                      <Badge variant="outline">{BOARD_LABEL[board]}</Badge>
                    </div>
                    <CardTitle className="text-base">
                      <Link
                        href={`/community/${board}/${post.id}`}
                        className="underline underline-offset-4"
                      >
                        {post.title}
                      </Link>
                    </CardTitle>
                    <CardDescription>{author}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/community/${board}/${post.id}/edit`}>수정</Link>}
                    />
                    <form action={deletePost.bind(null, board, post.id)}>
                      <Button type="submit" size="sm" variant="ghost">
                        삭제
                      </Button>
                    </form>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
          {(!posts || posts.length === 0) && (
            <p className="text-sm text-muted-foreground">게시글이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
