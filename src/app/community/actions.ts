"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COMMUNITY_IMAGE_BUCKET } from "@/lib/supabase/service";
import { isCommunityBoard, type CommunityBoard } from "@/lib/community-boards";
import { logAdminAction } from "@/lib/audit";
import { suspensionMessage } from "@/lib/moderation";

export type PostFormState = { error: string | null };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function extensionFor(file: File): string {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  if (byType[file.type]) return byType[file.type];
  const fromName = file.name.split(".").pop();
  return fromName && fromName.length <= 5 ? fromName.toLowerCase() : "jpg";
}

export async function createPost(
  board: CommunityBoard,
  _prevState: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const image = formData.get("image");

  if (!isCommunityBoard(board)) {
    return { error: "잘못된 게시판입니다." };
  }
  if (!title || !body) {
    return { error: "제목과 내용을 모두 입력해주세요." };
  }
  if (image instanceof File && image.size > MAX_IMAGE_BYTES) {
    return { error: "이미지는 5MB 이하로 올려주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }
  if (user.is_anonymous) {
    return { error: "글을 작성하려면 회원가입이 필요합니다." };
  }

  const suspension = await suspensionMessage(supabase, user.id);
  if (suspension) {
    return { error: suspension };
  }

  const { data: post, error: postError } = await supabase
    .from("community_posts")
    .insert({ board, author_id: user.id, title, body })
    .select("id")
    .single();

  if (postError || !post) {
    return { error: postError?.message ?? "글 작성에 실패했습니다." };
  }

  if (image instanceof File && image.size > 0) {
    const path = `${post.id}/${crypto.randomUUID()}.${extensionFor(image)}`;
    const { error: uploadError } = await supabase.storage
      .from(COMMUNITY_IMAGE_BUCKET)
      .upload(path, image, { contentType: image.type, upsert: true });

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

  revalidatePath(`/community/${board}`);
  redirect(`/community/${board}/${post.id}`);
}

export async function updatePost(
  board: CommunityBoard,
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

export async function deletePost(board: CommunityBoard, postId: string) {
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

export async function toggleLike(board: CommunityBoard, postId: string) {
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
