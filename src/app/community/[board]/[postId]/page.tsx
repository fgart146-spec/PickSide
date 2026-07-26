import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { isCommunityBoard, BOARD_LABEL } from "@/lib/community-boards";
import { toggleLike, deletePost } from "@/app/community/actions";
import { deleteComment } from "@/app/community/comments/actions";
import { reportPost, reportComment } from "@/app/community/reports/actions";
import { COMMUNITY_IMAGE_BUCKET } from "@/lib/supabase/service";
import { CommunityCommentForm } from "@/components/community-comment-form";
import { ReportButton } from "@/components/report-button";
import { CategoryNav, CommunityNav, SortNav } from "@/components/browse-nav";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function CommunityPostPage({
  params,
}: {
  params: Promise<{ board: string; postId: string }>;
}) {
  const { board, postId } = await params;
  if (!isCommunityBoard(board)) {
    notFound();
  }

  const supabase = await createClient();

  const [{ data: post }, { data: likes }, { data: comments }, { data: auth }] =
    await Promise.all([
      supabase
        .from("community_posts")
        .select(
          "id, title, body, image_path, view_count, created_at, author_id, profiles!community_posts_author_id_fkey(username)"
        )
        .eq("id", postId)
        .eq("board", board)
        .is("deleted_at", null)
        .single(),
      supabase.from("community_post_likes").select("user_id").eq("post_id", postId),
      supabase
        .from("community_comments")
        .select("id, body, created_at, author_id, profiles(username)")
        .eq("post_id", postId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      supabase.auth.getUser(),
      supabase.rpc("increment_community_post_view", { p_post_id: postId }),
    ]);

  if (!post) {
    notFound();
  }

  const currentUserId = auth.user?.id ?? null;
  const isAnonymous = auth.user?.is_anonymous ?? false;
  const isOwner = currentUserId === post.author_id;
  const authorUsername =
    (post as unknown as { profiles: { username: string } | null }).profiles
      ?.username ?? "알 수 없음";
  const likeCount = likes?.length ?? 0;
  const hasLiked = likes?.some((l) => l.user_id === currentUserId) ?? false;

  let isAdmin = false;
  if (currentUserId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", currentUserId)
      .single();
    isAdmin = profile?.is_admin ?? false;
  }

  let imageUrl: string | null = null;
  if (post.image_path) {
    const { data } = supabase.storage
      .from(COMMUNITY_IMAGE_BUCKET)
      .getPublicUrl(post.image_path);
    imageUrl = data.publicUrl;
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <aside className="hidden lg:flex lg:flex-col lg:gap-6">
        <div className="flex flex-col gap-1">
          <span className="mb-1 text-xs font-medium text-muted-foreground">카테고리</span>
          <CategoryNav />
        </div>
        <div className="flex flex-col gap-1 border-t pt-4">
          <span className="mb-1 text-xs font-medium text-muted-foreground">커뮤니티</span>
          <CommunityNav />
        </div>
        <div className="flex flex-col gap-1 border-t pt-4">
          <span className="mb-1 text-xs font-medium text-muted-foreground">정렬</span>
          <SortNav />
        </div>
      </aside>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 lg:mx-0">
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={`/community/${board}/random`}>다음 글 →</Link>}
          />
        </div>
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <p className="text-xs text-muted-foreground">{BOARD_LABEL[board]}</p>
              <CardTitle className="text-2xl">{post.title}</CardTitle>
              <CardDescription>
                {authorUsername} · 조회수 {post.view_count}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {isOwner && (
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/community/${board}/${postId}/edit`}>수정</Link>}
                />
              )}
              {(isOwner || isAdmin) && (
                <form action={deletePost.bind(null, board, postId)}>
                  <Button type="submit" size="sm" variant="outline">
                    삭제
                  </Button>
                </form>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {imageUrl && (
              <Image
                src={imageUrl}
                alt=""
                width={480}
                height={320}
                className="w-full rounded-md object-cover"
                unoptimized
              />
            )}
            <p className="whitespace-pre-wrap text-sm">{post.body}</p>
            <div className="flex items-center gap-2">
              <form action={toggleLike.bind(null, board, postId)}>
                <Button type="submit" size="sm" variant={hasLiked ? "default" : "outline"}>
                  👍 좋아요 {likeCount}
                </Button>
              </form>
              {currentUserId && !isAnonymous && !isOwner && (
                <ReportButton action={reportPost.bind(null, postId)} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">댓글 {comments?.length ?? 0}개</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {comments?.map((comment) => {
                const commentAuthor =
                  (comment as unknown as { profiles: { username: string } | null })
                    .profiles?.username ?? "알 수 없음";
                const canDelete = currentUserId === comment.author_id || isAdmin;

                return (
                  <div
                    key={comment.id}
                    className="flex items-start justify-between gap-2 border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{commentAuthor}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {comment.body}
                      </p>
                    </div>
                    {canDelete && (
                      <form action={deleteComment.bind(null, board, postId, comment.id)}>
                        <Button type="submit" size="sm" variant="ghost">
                          삭제
                        </Button>
                      </form>
                    )}
                    {!canDelete && currentUserId && !isAnonymous && (
                      <ReportButton action={reportComment.bind(null, comment.id)} />
                    )}
                  </div>
                );
              })}
              {(!comments || comments.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  아직 댓글이 없어요. 첫 댓글을 남겨보세요.
                </p>
              )}
            </div>

            {currentUserId && !isAnonymous && (
              <CommunityCommentForm board={board} postId={postId} />
            )}
            {currentUserId && isAnonymous && (
              <p className="text-sm text-muted-foreground">
                댓글을 작성하려면{" "}
                <Link href="/signup" className="underline underline-offset-4">
                  회원가입
                </Link>
                이 필요합니다.
              </p>
            )}
            {!currentUserId && (
              <p className="text-sm text-muted-foreground">
                댓글을 작성하려면{" "}
                <Link href="/login" className="underline underline-offset-4">
                  로그인
                </Link>
                이 필요합니다.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
