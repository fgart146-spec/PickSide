"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { suspensionMessage } from "@/lib/moderation";
import { notifyUser } from "@/lib/notifications";

export type CommentState = { error: string | null };

export async function createComment(
  pollId: string,
  _prevState: CommentState,
  formData: FormData
): Promise<CommentState> {
  const body = String(formData.get("body") ?? "").trim();

  if (!body) {
    return { error: "댓글 내용을 입력해주세요." };
  }
  if (body.length > 500) {
    return { error: "댓글은 500자 이하로 작성해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }
  if (user.is_anonymous) {
    return { error: "댓글을 작성하려면 회원가입이 필요합니다." };
  }

  const suspension = await suspensionMessage(supabase, user.id);
  if (suspension) {
    return { error: suspension };
  }

  const { error } = await supabase
    .from("comments")
    .insert({ poll_id: pollId, author_id: user.id, body });

  if (error) {
    return { error: error.message };
  }

  const { data: poll } = await supabase
    .from("polls")
    .select("question, owner_id")
    .eq("id", pollId)
    .single();
  if (poll && poll.owner_id !== user.id) {
    await notifyUser({
      userId: poll.owner_id,
      type: "poll_comment",
      message: `"${poll.question}"에 새 댓글이 달렸습니다.`,
      link: `/polls/${pollId}#comments`,
    });
  }

  revalidatePath(`/polls/${pollId}`);
  return { error: null };
}

export async function deleteComment(pollId: string, commentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: comment } = await supabase
    .from("comments")
    .select("author_id")
    .eq("id", commentId)
    .single();

  const isAuthor = user && comment?.author_id === user.id;

  if (isAuthor) {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) throw new Error(error.message);
  } else {
    // Admin moderation: soft-delete so it can be restored from the trash.
    const { error } = await supabase
      .from("comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", commentId);
    if (error) throw new Error(error.message);

    if (user) {
      await logAdminAction(supabase, {
        adminId: user.id,
        action: "comments.delete",
        targetType: "comments",
        targetId: commentId,
      });
    }
  }

  revalidatePath(`/polls/${pollId}`);
}

export async function toggleCommentLike(pollId: string, commentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    redirect("/login");
  }

  const { data: existing } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("comment_likes")
      .insert({ comment_id: commentId, user_id: user.id });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/polls/${pollId}`);
}
