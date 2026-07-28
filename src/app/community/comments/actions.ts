"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { suspensionMessage } from "@/lib/moderation";
import { notifyUser } from "@/lib/notifications";

export type CommunityCommentState = { error: string | null };

export async function createComment(
  board: string,
  postId: string,
  _prevState: CommunityCommentState,
  formData: FormData
): Promise<CommunityCommentState> {
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

  const { data: post } = await supabase
    .from("community_posts")
    .select("title, author_id, community_boards(allow_comments, is_deleted)")
    .eq("id", postId)
    .single();
  const postBoard = (
    post as unknown as { community_boards: { allow_comments: boolean; is_deleted: boolean } | null } | null
  )?.community_boards;
  if (!postBoard || postBoard.is_deleted || !postBoard.allow_comments) {
    return { error: "이 게시판은 댓글 작성이 제한되어 있습니다." };
  }

  const suspension = await suspensionMessage(supabase, user.id);
  if (suspension) {
    return { error: suspension };
  }

  const { error } = await supabase
    .from("community_comments")
    .insert({ post_id: postId, author_id: user.id, body });

  if (error) {
    return { error: error.message };
  }

  if (post && post.author_id !== user.id) {
    await notifyUser({
      userId: post.author_id,
      type: "community_comment",
      message: `"${post.title}"에 새 댓글이 달렸습니다.`,
      link: `/community/${board}/${postId}#comments`,
    });
  }

  revalidatePath(`/community/${board}/${postId}`);
  return { error: null };
}

export async function deleteComment(
  board: string,
  postId: string,
  commentId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: comment } = await supabase
    .from("community_comments")
    .select("author_id")
    .eq("id", commentId)
    .single();

  const isAuthor = user && comment?.author_id === user.id;

  if (isAuthor) {
    const { error } = await supabase
      .from("community_comments")
      .delete()
      .eq("id", commentId);
    if (error) throw new Error(error.message);
  } else {
    // Admin moderation: soft-delete so it can be restored from the trash.
    const { error } = await supabase
      .from("community_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", commentId);
    if (error) throw new Error(error.message);

    if (user) {
      await logAdminAction(supabase, {
        adminId: user.id,
        action: "community_comments.delete",
        targetType: "community_comments",
        targetId: commentId,
      });
    }
  }

  revalidatePath(`/community/${board}/${postId}`);
}
