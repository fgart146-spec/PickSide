import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  restorePoll,
  permanentlyDeletePoll,
  restoreComment,
  permanentlyDeleteComment,
  restoreCommunityPost,
  permanentlyDeleteCommunityPost,
  restoreCommunityComment,
  permanentlyDeleteCommunityComment,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function TrashSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} ({count})
      </h2>
      {count === 0 && <p className="text-sm text-muted-foreground">비어 있습니다.</p>}
      {children}
    </div>
  );
}

function RestoreDeleteActions({
  restoreAction,
  deleteAction,
}: {
  restoreAction: () => Promise<void>;
  deleteAction: () => Promise<void>;
}) {
  return (
    <div className="flex gap-2">
      <form action={restoreAction}>
        <Button type="submit" size="sm" variant="outline">
          복구
        </Button>
      </form>
      <form action={deleteAction}>
        <Button type="submit" size="sm" variant="destructive">
          영구 삭제
        </Button>
      </form>
    </div>
  );
}

export default async function AdminTrashPage() {
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

  const [
    { data: deletedPolls },
    { data: deletedComments },
    { data: deletedPosts },
    { data: deletedCommunityComments },
  ] = await Promise.all([
    supabase
      .from("polls")
      .select("id, question, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("comments")
      .select("id, body, deleted_at, poll_id, polls(question)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("community_posts")
      .select("id, title, board, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("community_comments")
      .select("id, body, deleted_at, post_id, community_posts(title, board)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">관리자 휴지통</h1>
          <p className="text-sm text-muted-foreground">
            관리자가 삭제한 콘텐츠를 복구하거나 영구 삭제할 수 있습니다.
          </p>
        </div>

        <TrashSection title="투표" count={deletedPolls?.length ?? 0}>
          {deletedPolls?.map((poll) => (
            <Card key={poll.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{poll.question}</CardTitle>
                <RestoreDeleteActions
                  restoreAction={restorePoll.bind(null, poll.id)}
                  deleteAction={permanentlyDeletePoll.bind(null, poll.id)}
                />
              </CardHeader>
            </Card>
          ))}
        </TrashSection>

        <TrashSection title="투표 댓글" count={deletedComments?.length ?? 0}>
          {deletedComments?.map((comment) => {
            const pollQuestion =
              (comment as unknown as { polls: { question: string } | null }).polls
                ?.question ?? "삭제된 투표";
            return (
              <Card key={comment.id}>
                <CardHeader>
                  <CardTitle className="text-sm">{pollQuestion}</CardTitle>
                  <CardDescription className="whitespace-pre-wrap">
                    {comment.body}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RestoreDeleteActions
                    restoreAction={restoreComment.bind(null, comment.id)}
                    deleteAction={permanentlyDeleteComment.bind(null, comment.id)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </TrashSection>

        <TrashSection title="커뮤니티 게시글" count={deletedPosts?.length ?? 0}>
          {deletedPosts?.map((post) => (
            <Card key={post.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{post.title}</CardTitle>
                <RestoreDeleteActions
                  restoreAction={restoreCommunityPost.bind(null, post.id)}
                  deleteAction={permanentlyDeleteCommunityPost.bind(null, post.id)}
                />
              </CardHeader>
            </Card>
          ))}
        </TrashSection>

        <TrashSection
          title="커뮤니티 댓글"
          count={deletedCommunityComments?.length ?? 0}
        >
          {deletedCommunityComments?.map((comment) => {
            const postTitle =
              (comment as unknown as { community_posts: { title: string } | null })
                .community_posts?.title ?? "삭제된 게시글";
            return (
              <Card key={comment.id}>
                <CardHeader>
                  <CardTitle className="text-sm">{postTitle}</CardTitle>
                  <CardDescription className="whitespace-pre-wrap">
                    {comment.body}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RestoreDeleteActions
                    restoreAction={restoreCommunityComment.bind(null, comment.id)}
                    deleteAction={permanentlyDeleteCommunityComment.bind(null, comment.id)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </TrashSection>
      </div>
    </div>
  );
}
