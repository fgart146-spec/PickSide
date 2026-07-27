import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteComment } from "@/app/comments/actions";
import { reportPoll, reportComment } from "@/app/reports/actions";
import { PRIVATE_IMAGE_BUCKET, PUBLIC_IMAGE_BUCKET } from "@/lib/supabase/service";
import { VsPoll } from "@/components/vs-poll";
import { CommentForm } from "@/components/comment-form";
import { ReportButton } from "@/components/report-button";
import { AdSlot } from "@/components/ad-slot";
import { CategoryNav, CommunityNav, SortNav } from "@/components/browse-nav";
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

export default async function PollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: poll }, { data: options }, { data: votes }, { data: auth }, { data: comments }] =
    await Promise.all([
      supabase
        .from("polls")
        .select("id, question, created_at, owner_id, status, category, view_count, profiles(username)")
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
        .select("id, body, created_at, author_id, profiles(username)")
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

  const isOwner = currentUserId === poll.owner_id;
  const isPublished = poll.status === "published";

  let isAdmin = false;
  if (currentUserId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", currentUserId)
      .single();
    isAdmin = profile?.is_admin ?? false;
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
            <CardHeader>
              <CardTitle className="text-base">댓글 {comments?.length ?? 0}개</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                {comments?.map((comment) => {
                  const authorUsername =
                    (comment as unknown as { profiles: { username: string } | null })
                      .profiles?.username ?? "알 수 없음";
                  const canDelete = currentUserId === comment.author_id || isAdmin;

                  return (
                    <div
                      key={comment.id}
                      className="flex items-start justify-between gap-2 border-b pb-3 last:border-b-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{authorUsername}</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {comment.body}
                        </p>
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
