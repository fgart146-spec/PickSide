"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COMMUNITY_IMAGE_BUCKET } from "@/lib/supabase/service";
import { isCommunityBoard } from "@/lib/community-boards";
import { getBoardBySlug } from "@/lib/community-boards-data";
import { logAdminAction } from "@/lib/audit";
import { suspensionMessage } from "@/lib/moderation";
import { toOptimizedWebp } from "@/lib/image-processing";

export type PostFormState = { error: string | null };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// GIFs are left untouched — re-encoding to WebP without extra handling
// collapses animation to a single static frame, which would break the
// meme/reaction-image use case this board's image upload exists for.
function isAnimatedGif(file: File): boolean {
  return file.type === "image/gif";
}

export async function createPost(
  boardSlug: string,
  _prevState: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const image = formData.get("image");

  const board = await getBoardBySlug(boardSlug);
  if (!board) {
    return { error: "잘못된 게시판입니다." };
  }
  if (!title || !body) {
    return { error: "제목과 내용을 모두 입력해주세요." };
  }
  if (image instanceof File && image.size > MAX_IMAGE_BYTES) {
    return { error: "이미지는 5MB 이하로 올려주세요." };
  }
  if (image instanceof File && image.size > 0 && !board.allow_images) {
    return { error: "이 게시판은 이미지 첨부를 허용하지 않습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }
  if (user.is_anonymous && !board.allow_anonymous) {
    return { error: "글을 작성하려면 회원가입이 필요합니다." };
  }

  if (!board.allow_posts) {
    return { error: "이 게시판은 현재 글쓰기가 제한되어 있습니다." };
  }

  if (board.admin_only_posting) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) {
      return { error: "이 게시판은 관리자만 글을 작성할 수 있습니다." };
    }
  }

  const suspension = await suspensionMessage(supabase, user.id);
  if (suspension) {
    return { error: suspension };
  }

  // `board` (the legacy enum column) is NOT NULL and only covers the
  // original 4 boards, so a brand-new admin-created board falls back to
  // "free" there — matching the "기타" fallback used for poll categories.
  // `board_id` is authoritative everywhere going forward.
  const legacyBoard = isCommunityBoard(board.slug) ? board.slug : "free";

  const { data: post, error: postError } = await supabase
    .from("community_posts")
    .insert({
      board_id: board.id,
      board: legacyBoard,
      author_id: user.id,
      title,
      body,
    })
    .select("id")
    .single();

  if (postError || !post) {
    return { error: postError?.message ?? "글 작성에 실패했습니다." };
  }

  if (image instanceof File && image.size > 0) {
    const animated = isAnimatedGif(image);
    const path = `${post.id}/${crypto.randomUUID()}.${animated ? "gif" : "webp"}`;
    const body = animated
      ? image
      : await toOptimizedWebp(await image.arrayBuffer(), { maxWidth: 1200 });
    const { error: uploadError } = await supabase.storage
      .from(COMMUNITY_IMAGE_BUCKET)
      .upload(path, body, { contentType: animated ? "image/gif" : "image/webp", upsert: true });

    if (uploadError) {
      return { error: `이미지 업로드 실패: ${uploadError.message}` };
    }

    const { error: updateError } = await supabase
      .from("community_posts")
      .update({ image_path: path })
      .eq("id", post.id);

    if (updateError) {
      return { error: `이미지 경로 저장 실패: ${updateError.message}` };
    }
  }

  revalidatePath(`/community/${boardSlug}`);
  redirect(`/community/${boardSlug}/${post.id}`);
}

export async function updatePost(
  board: string,
  postId: string,
  _prevState: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title || !body) {
    return { error: "제목과 내용을 모두 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("community_posts")
    .update({ title, body, updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/community/${board}/${postId}`);
  redirect(`/community/${board}/${postId}`);
}

export async function deletePost(board: string, postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: post } = await supabase
    .from("community_posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  const isAuthor = user && post?.author_id === user.id;

  if (isAuthor) {
    const { error } = await supabase.from("community_posts").delete().eq("id", postId);
    if (error) throw new Error(error.message);
  } else {
    // Admin moderation: soft-delete so it can be restored from the trash.
    const { error } = await supabase
      .from("community_posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", postId);
    if (error) throw new Error(error.message);

    if (user) {
      await logAdminAction(supabase, {
        adminId: user.id,
        action: "community_posts.delete",
        targetType: "community_posts",
        targetId: postId,
      });
    }
  }

  revalidatePath(`/community/${board}`);
  redirect(`/community/${board}`);
}

export async function toggleLike(board: string, postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    redirect("/login");
  }

  const { data: existing } = await supabase
    .from("community_post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("community_post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("community_post_likes")
      .insert({ post_id: postId, user_id: user.id });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/community/${board}/${postId}`);
}
