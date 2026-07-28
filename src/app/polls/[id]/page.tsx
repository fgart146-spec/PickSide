import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRightIcon, ThumbsUpIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, PRIVATE_IMAGE_BUCKET, PUBLIC_IMAGE_BUCKET } from "@/lib/supabase/service";
import { deleteComment, toggleCommentLike } from "@/app/comments/actions";
import { reportPoll, reportComment } from "@/app/reports/actions";
import { VsPoll } from "@/components/vs-poll";
import { CommentForm } from "@/components/comment-form";
import { ReportButton } from "@/components/report-button";
import { BookmarkButton } from "@/components/bookmark-button";
import { AdSlot } from "@/components/ad-slot";
import { BrowseSidebar } from "@/components/browse-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUS_LABEL: Record<string, string> = {
  pending: "승인 대기 중",
  rejected: "거절됨",
  published: "공개됨",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const service = createServiceClient();
  const { data: poll } = await service
    .from("polls")
    .select("question, poll_options(label)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!poll) {
    return { title: "PickSide" };
  }

  const options = (poll as unknown as { poll_options: { label: string }[] }).poll_options;
  const description =
    options.length >= 2 ? `${options[0].label} VS ${options[1].label}` : "PickSide 투표";

  return {
    title: `${poll.question} | PickSide`,
    description,
    openGraph: { title: poll.question, description },
    twitter: { card: "summary_large_image", title: poll.question, description },
  };
}

export default async function PollPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ commentSort?: string }>;
}) {
  const { id } = await params;
  const { commentSort } = await searchParams;
  const sortByPopular = commentSort === "popular";
  const supabase = await createClient();

  const [{ data: poll }, { data: options }, { data: votes }, { data: auth }, { data: comments }] =
    await Promise.all([
      supabase
        .from("polls")
        .select(
          "id, question, created_at, owner_id, status, category, view_count, profiles!polls_owner_id_fkey(username), categories!polls_category_id_fkey(slug)"
        )
        .eq("id", id)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("poll_options")
        .select("id, label, position, image_path")
        .eq("poll_id", id)
        .order("position"),
      supabase.from("votes").select("option_id, voter_id").eq("poll_id", id),
      supabase.auth.getUser(),
      supabase
        .from("comments")
        .select(
          "id, body, created_at, author_id, profiles!comments_author_id_fkey(username), comment_likes(user_id)"
        )
        .eq("poll_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      supabase.rpc("increment_poll_view", { p_poll_id: id }),
    ]);

  if (!poll || !options) {
    notFound();
  }

  const currentUserId = auth.user?.id ?? null;
  const isAnonymous = auth.user?.is_anonymous ?? false;
  const totalVotes = votes?.length ?? 0;
  const myVote = votes?.find((v) => v.voter_id === currentUserId)?.option_id;
  const hasVoted = myVote !== undefined;
  const ownerUsername =
    (poll as unknown as { profiles: { username: string } | null }).profiles
      ?.username ?? "알 수 없음";
  const categorySlug =
    (poll as unknown as { categories: { slug: string } | null }).categories?.slug ?? null;

  const isOwner = currentUserId === poll.owner_id;
  const isPublished = poll.status === "published";

  let isAdmin = false;
  let isBookmarked = false;
  if (currentUserId) {
    const [{ data: profile }, { data: bookmark }] = await Promise.all([
      supabase.from("profiles").select("is_admin").eq("id", currentUserId).single(),
      supabase
        .from("poll_bookmarks")
        .select("poll_id")
        .eq("poll_id", id)
        .eq("user_id", currentUserId)
        .maybeSingle(),
    ]);
    isAdmin = profile?.is_admin ?? false;
    isBookmarked = !!bookmark;
  }

  const optionImages = new Map<string, string>();
  for (const option of options) {
    if (!option.image_path) continue;
    if (isPublished) {
      const { data } = supabase.storage
        .from(PUBLIC_IMAGE_BUCKET)
        .getPublicUrl(option.image_path);
      optionImages.set(option.id, data.publicUrl);
    } else {
      const { data } = await supabase.storage
        .from(PRIVATE_IMAGE_BUCKET)
        .createSignedUrl(option.image_path, 60);
      if (data?.signedUrl) optionImages.set(option.id, data.signedUrl);
    }
  }

  if (options.length < 2) {
    notFound();
  }

  const [optionA, optionB] = options;
  const countFor = (optionId: string) =>
    votes?.filter((v) => v.option_id === optionId).length ?? 0;
  const majorityOptionId = countFor(optionA.id) >= countFor(optionB.id) ? optionA.id : optionB.id;

  type CommentRow = NonNullable<typeof comments>[number];
  const commentLikeCount = (comment: CommentRow) => comment.comment_likes?.length ?? 0;
  const sortedComments = [...(comments ?? [])].sort((a, b) =>
    sortByPopular ? commentLikeCount(b) - commentLikeCount(a) : 0
  );

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <BrowseSidebar activeCategory={categorySlug} />

      <div className="mx-auto flex w-full max-w-lg flex-col lg:mx-0">
        <div className="mb-4 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={
              <Link href="/polls/random">
                다음 투표
                <ChevronRightIcon />
              </Link>
            }
          />
        </div>
        <Card className="w-full shadow-sm">
          <CardHeader>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{poll.category}</Badge>
              {!isPublished && (
                <Badge variant={poll.status === "rejected" ? "destructive" : "secondary"}>
                  {STATUS_LABEL[poll.status]}
                </Badge>
              )}
            </div>
            <CardTitle className="text-2xl">{poll.question}</CardTitle>
            <CardDescription>
              만든 사람: {ownerUsername} · 조회수 {poll.view_count}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VsPoll
              pollId={id}
              question={poll.question}
              category={poll.category}
              optionA={{
                id: optionA.id,
                label: optionA.label,
                imageUrl: optionImages.get(optionA.id) ?? null,
              }}
              optionB={{
                id: optionB.id,
                label: optionB.label,
                imageUrl: optionImages.get(optionB.id) ?? null,
              }}
              votedOptionId={myVote ?? null}
              counts={
                hasVoted
                  ? { [optionA.id]: countFor(optionA.id), [optionB.id]: countFor(optionB.id) }
                  : null
              }
              totalVotes={totalVotes}
              commentCount={comments?.length ?? 0}
              canVote={isPublished}
              bookmarkSlot={
                currentUserId && !isAnonymous ? (
                  <BookmarkButton pollId={id} bookmarked={isBookmarked} />
                ) : undefined
              }
              reportSlot={
                currentUserId && !isAnonymous && !isOwner ? (
                  <ReportButton action={reportPoll.bind(null, id)} />
                ) : undefined
              }
            />
            {!isPublished && isOwner && (
              <p className="pt-4 text-sm text-muted-foreground">
                {poll.status === "pending"
                  ? "관리자 승인 후 공개 목록에 노출되고 투표가 가능해집니다."
                  : "이 투표는 거절되어 공개되지 않습니다."}
              </p>
            )}
            {isPublished && !currentUserId && (
              <p className="pt-4 text-sm text-muted-foreground">
                비회원으로도 투표할 수 있어요. 이 브라우저에 참여 기록이 저장됩니다.
              </p>
            )}
          </CardContent>
        </Card>

        {isPublished && (
          <Card id="comments" className="mt-6 w-full scroll-mt-20">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">댓글 {comments?.length ?? 0}개</CardTitle>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={sortByPopular ? "outline" : "default"}
                  nativeButton={false}
                  render={<Link href={`/polls/${id}#comments`}>최신순</Link>}
                />
                <Button
                  size="sm"
                  variant={sortByPopular ? "default" : "outline"}
                  nativeButton={false}
                  render={<Link href={`/polls/${id}?commentSort=popular#comments`}>좋아요순</Link>}
                />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                {sortedComments.map((comment) => {
                  const authorUsername =
                    (comment as unknown as { profiles: { username: string } | null })
                      .profiles?.username ?? "알 수 없음";
                  const canDelete = currentUserId === comment.author_id || isAdmin;
                  const likeCount = commentLikeCount(comment);
                  const hasLiked =
                    comment.comment_likes?.some((l) => l.user_id === currentUserId) ?? false;
                  const authorVote = votes?.find((v) => v.voter_id === comment.author_id);
                  const opinionTag =
                    hasVoted && totalVotes > 0 && authorVote
                      ? authorVote.option_id === majorityOptionId
                        ? "다수 의견"
                        : "소수 의견"
                      : null;

                  return (
                    <div
                      key={comment.id}
                      className="flex items-start justify-between gap-2 border-b pb-3 last:border-b-0 last:pb-0"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium">{authorUsername}</p>
                          {opinionTag && (
                            <Badge variant={opinionTag === "다수 의견" ? "default" : "secondary"}>
                              {opinionTag}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {comment.body}
                        </p>
                        <form action={toggleCommentLike.bind(null, id, comment.id)} className="mt-1">
                          <Button
                            type="submit"
                            size="sm"
                            variant={hasLiked ? "default" : "ghost"}
                            className="h-6 gap-1 px-1.5 text-xs"
                          >
                            <ThumbsUpIcon className="size-3" />
                            {likeCount}
                          </Button>
                        </form>
                      </div>
                      {canDelete && (
                        <form action={deleteComment.bind(null, id, comment.id)}>
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

              {currentUserId && !isAnonymous && <CommentForm pollId={id} />}
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

        <div className="mt-6 w-full">
          <AdSlot slot="poll-detail-bottom" />
        </div>
      </div>
    </div>
  );
}
