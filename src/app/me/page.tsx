import { redirect } from "next/navigation";
import Link from "next/link";
import { UserIcon, FileTextIcon, MessageSquareIcon, ThumbsUpIcon, BookmarkIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UsernameForm } from "@/components/username-form";
import { Badge } from "@/components/ui/badge";
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

export default async function MyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  if (user.is_anonymous) {
    redirect("/signup");
  }

  const [{ data: profile }, { data: myPolls }, { data: myComments }, { data: myVotes }, { data: myBookmarks }] =
    await Promise.all([
      supabase.from("profiles").select("username").eq("id", user.id).single(),
      supabase
        .from("polls")
        .select("id, question, status, created_at")
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("comments")
        .select("id, body, created_at, poll_id, polls(question)")
        .eq("author_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("votes")
        .select("id, created_at, poll_id, poll_options(label), polls(question)")
        .eq("voter_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("poll_bookmarks")
        .select("poll_id, created_at, polls(question, deleted_at)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  const bookmarkedPolls = (
    (myBookmarks as unknown as {
      poll_id: string;
      polls: { question: string; deleted_at: string | null } | null;
    }[]) ?? []
  )
    .filter((b) => b.polls && !b.polls.deleted_at)
    .map((b) => ({ poll_id: b.poll_id, question: b.polls!.question }));

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-8">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <UserIcon className="size-6 text-primary" />
            마이페이지
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">닉네임 변경</CardTitle>
          </CardHeader>
          <CardContent>
            <UsernameForm currentUsername={profile?.username ?? ""} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <FileTextIcon className="size-4" />
            내가 작성한 투표 ({myPolls?.length ?? 0})
          </h2>
          {(!myPolls || myPolls.length === 0) && (
            <p className="text-sm text-muted-foreground">아직 만든 투표가 없어요.</p>
          )}
          {myPolls?.map((poll) => (
            <Link key={poll.id} href={`/polls/${poll.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{poll.question}</CardTitle>
                  <Badge
                    variant={
                      poll.status === "published"
                        ? "default"
                        : poll.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {STATUS_LABEL[poll.status]}
                  </Badge>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <MessageSquareIcon className="size-4" />
            내가 댓글 단 글 ({myComments?.length ?? 0})
          </h2>
          {(!myComments || myComments.length === 0) && (
            <p className="text-sm text-muted-foreground">아직 작성한 댓글이 없어요.</p>
          )}
          {myComments?.map((comment) => {
            const pollQuestion =
              (comment as unknown as { polls: { question: string } | null }).polls
                ?.question ?? "삭제된 투표";
            return (
              <Link key={comment.id} href={`/polls/${comment.poll_id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="text-base">{pollQuestion}</CardTitle>
                    <CardDescription className="whitespace-pre-wrap">
                      {comment.body}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <ThumbsUpIcon className="size-4" />
            내가 투표한 글 ({myVotes?.length ?? 0})
          </h2>
          {(!myVotes || myVotes.length === 0) && (
            <p className="text-sm text-muted-foreground">아직 투표한 글이 없어요.</p>
          )}
          {myVotes?.map((vote) => {
            const pollQuestion =
              (vote as unknown as { polls: { question: string } | null }).polls
                ?.question ?? "삭제된 투표";
            const optionLabel =
              (vote as unknown as { poll_options: { label: string } | null })
                .poll_options?.label ?? "알 수 없음";
            return (
              <Link key={vote.id} href={`/polls/${vote.poll_id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="text-base">{pollQuestion}</CardTitle>
                    <CardDescription>내 선택: {optionLabel}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <BookmarkIcon className="size-4" />
            북마크한 투표 ({bookmarkedPolls.length})
          </h2>
          {bookmarkedPolls.length === 0 && (
            <p className="text-sm text-muted-foreground">아직 북마크한 투표가 없어요.</p>
          )}
          {bookmarkedPolls.map((bookmark) => (
            <Link key={bookmark.poll_id} href={`/polls/${bookmark.poll_id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle className="text-base">{bookmark.question}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
