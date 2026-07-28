import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ThumbsUpIcon, ChevronRightIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getBoardBySlug } from "@/lib/community-boards-data";
import { toggleLike, deletePost } from "@/app/community/actions";
import { deleteComment } from "@/app/community/comments/actions";
import { reportPost, reportComment } from "@/app/community/reports/actions";
import { COMMUNITY_IMAGE_BUCKET, createServiceClient } from "@/lib/supabase/service";
import { CommunityCommentForm } from "@/components/community-comment-form";
import { ReportButton } from "@/components/report-button";
import { BrowseSidebar } from "@/components/browse-sidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ board: string; postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const service = createServiceClient();
  const { data: post } = await service
    .from("community_posts")
    .select("title, body")
    .eq("id", postId)
    .is("deleted_at", null)
    .single();

  if (!post) {
    return { title: "PickSide" };
  }

  const description = post.body.slice(0, 100);
  return {
    title: `${post.title} | PickSide`,
    description,
    openGraph: { title: post.title, description },
  };
}

export default async function CommunityPostPage({
  params,
}: {
  params: Promise<{ board: string; postId: string }>;
}) {
  const { board: boardSlug, postId } = await params;
  const board = await getBoardBySlug(boardSlug);
  if (!board) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const currentUserId = authUser?.id ?? null;
  const isAnonymous = authUser?.is_anonymous ?? false;

  let isAdmin = false;
  if (currentUserId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", currentUserId)
      .single();
    isAdmin = profile?.is_admin ?? false;
  }

  if (!board.is_visible && !isAdmin) {
    notFound();
  }
  if (!board.allow_guest_view && !authUser) {
    redirect(`/login?next=/community/${boardSlug}/${postId}`);
  }

  const [{ data: post }, { data: likes }, { data: comments }] = await Promise.all([
    supabase
      .from("community_posts")
      .select(
        "id, title, body, image_path, view_count, created_at, author_id, profiles!community_posts_author_id_fkey(username)"
      )
      .eq("id", postId)
      .eq("board_id", board.id)
      .is("deleted_at", null)
      .single(),
    supabase.from("community_post_likes").select("user_id").eq("post_id", postId),
    supabase
      .from("community_comments")
      .select("id, body, created_at, author_id, profiles(username)")
      .eq("post_id", postId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase.rpc("increment_community_post_view", { p_post_id: postId }),
  ]);

  if (!post) {
    notFound();
  }

  const isOwner = currentUserId === post.author_id;
  const authorUsername =
    (post as unknown as { profiles: { username: string } | null }).profiles
      ?.username ?? "알 수 없음";
  const likeCount = likes?.length ?? 0;
  const hasLiked = likes?.some((l) => l.user_id === currentUserId) ?? false;

  let imageUrl: string | null = null;
  if (post.image_path) {
    const { data } = supabase.storage
      .from(COMMUNITY_IMAGE_BUCKET)
      .getPublicUrl(post.image_path);
    imageUrl = data.publicUrl;
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <BrowseSidebar />

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 lg:mx-0">
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={
              <Link href={`/community/${boardSlug}/random`}>
                다음 글
                <ChevronRightIcon />
              </Link>
            }
          />
        </div>
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <p className="text-xs text-muted-foreground">{board.name}</p>
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
                  render={<Link href={`/community/${boardSlug}/${postId}/edit`}>수정</Link>}
                />
              )}
              {(isOwner || isAdmin) && (
                <form action={deletePost.bind(null, boardSlug, postId)}>
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
                sizes="(max-width: 640px) 100vw, 480px"
                className="h-auto w-full rounded-md object-cover"
              />
            )}
            <p className="whitespace-pre-wrap text-sm">{post.body}</p>
            <div className="flex items-center gap-2">
              <form action={toggleLike.bind(null, boardSlug, postId)}>
                <Button type="submit" size="sm" variant={hasLiked ? "default" : "outline"}>
                  <ThumbsUpIcon />
                  좋아요 {likeCount}
                </Button>
              </form>
              {currentUserId && !isAnonymous && !isOwner && (
                <ReportButton action={reportPost.bind(null, postId)} />
              )}
            </div>
          </CardContent>
        </Card>

        {board.allow_comments && (
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
                      <form action={deleteComment.bind(null, boardSlug, postId, comment.id)}>
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
              <CommunityCommentForm board={boardSlug} postId={postId} />
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
        )}
      </div>
    </div>
  );
}
