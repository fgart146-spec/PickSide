import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deletePost } from "@/app/community/actions";
import { toggleCommunityPostPin } from "@/app/admin/community/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/pagination";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminCommunityPostsPage({
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
    .from("community_posts")
    .select(
      "id, title, is_pinned, created_at, profiles!community_posts_author_id_fkey(username), community_boards!community_posts_board_id_fkey(slug, name)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE);

  const rows = data ?? [];
  const hasNext = rows.length > PAGE_SIZE;
  const posts = rows.slice(0, PAGE_SIZE);

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">전체 커뮤니티 게시글</h1>
          <p className="text-sm text-muted-foreground">
            게시글을 최신순으로 표시합니다.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {posts?.map((post) => {
            const author =
              (post as unknown as { profiles: { username: string } | null }).profiles
                ?.username ?? "알 수 없음";
            const board = (
              post as unknown as { community_boards: { slug: string; name: string } | null }
            ).community_boards;
            const boardSlug = board?.slug ?? "";
            return (
              <Card key={post.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <div className="mb-1 flex items-center gap-1.5">
                      <Badge variant="outline">{board?.name ?? "알 수 없음"}</Badge>
                      {post.is_pinned && <Badge>공지 고정</Badge>}
                    </div>
                    <CardTitle className="text-base">
                      <Link
                        href={`/community/${boardSlug}/${post.id}`}
                        className="underline underline-offset-4"
                      >
                        {post.title}
                      </Link>
                    </CardTitle>
                    <CardDescription>{author}</CardDescription>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/community/${boardSlug}/${post.id}/edit`}>수정</Link>}
                    />
                    <form action={toggleCommunityPostPin.bind(null, post.id, !post.is_pinned)}>
                      <Button type="submit" size="sm" variant="outline">
                        {post.is_pinned ? "고정 해제" : "공지로 고정"}
                      </Button>
                    </form>
                    <form action={deletePost.bind(null, boardSlug, post.id)}>
                      <Button type="submit" size="sm" variant="ghost">
                        삭제
                      </Button>
                    </form>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
          {posts.length === 0 && (
            <p className="text-sm text-muted-foreground">게시글이 없습니다.</p>
          )}
        </div>

        <Pagination
          page={page}
          hasNext={hasNext}
          makeHref={(p) =>
            p > 1 ? `/admin/community/posts?page=${p}` : "/admin/community/posts"
          }
        />
      </div>
    </div>
  );
}
