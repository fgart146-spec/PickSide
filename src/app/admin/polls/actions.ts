"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { logAdminAction } from "@/lib/audit";
import { isPollCategory } from "@/lib/categories";
import {
  createServiceClient,
  PRIVATE_IMAGE_BUCKET,
  PUBLIC_IMAGE_BUCKET,
} from "@/lib/supabase/service";

export type AdminPollEditState = { error: string | null };

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

export async function adminUpdatePoll(
  pollId: string,
  _prevState: AdminPollEditState,
  formData: FormData
): Promise<AdminPollEditState> {
  const { supabase, adminId } = await requireAdmin();

  const question = String(formData.get("question") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const optionAId = String(formData.get("optionAId") ?? "");
  const optionALabel = String(formData.get("optionALabel") ?? "").trim();
  const optionBId = String(formData.get("optionBId") ?? "");
  const optionBLabel = String(formData.get("optionBLabel") ?? "").trim();

  if (!question || !optionALabel || !optionBLabel) {
    return { error: "질문과 두 선택지를 모두 입력해주세요." };
  }
  if (!isPollCategory(category)) {
    return { error: "올바른 카테고리를 선택해주세요." };
  }

  const { error: pollError } = await supabase
    .from("polls")
    .update({ question, category })
    .eq("id", pollId);
  if (pollError) {
    return { error: pollError.message };
  }

  const { error: optionError } = await supabase
    .from("poll_options")
    .update({ label: optionALabel })
    .eq("id", optionAId);
  if (optionError) {
    return { error: optionError.message };
  }

  const { error: optionBError } = await supabase
    .from("poll_options")
    .update({ label: optionBLabel })
    .eq("id", optionBId);
  if (optionBError) {
    return { error: optionBError.message };
  }

  await logAdminAction(supabase, {
    adminId,
    action: "poll.edit",
    targetType: "poll",
    targetId: pollId,
  });

  revalidatePath(`/admin/polls/${pollId}`);
  revalidatePath(`/polls/${pollId}`);
  revalidatePath("/");
  return { error: null };
}

export async function adminForceHidePoll(pollId: string) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase
    .from("polls")
    .update({ status: "hidden" })
    .eq("id", pollId);
  if (error) throw new Error(error.message);

  await logAdminAction(supabase, {
    adminId,
    action: "poll.force_hide",
    targetType: "poll",
    targetId: pollId,
  });

  revalidatePath(`/admin/polls/${pollId}`);
  revalidatePath("/admin/polls");
  revalidatePath(`/polls/${pollId}`);
  revalidatePath("/");
}

export async function adminTogglePin(pollId: string, next: boolean) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase
    .from("polls")
    .update({ is_pinned: next })
    .eq("id", pollId);
  if (error) throw new Error(error.message);

  await logAdminAction(supabase, {
    adminId,
    action: next ? "poll.pin" : "poll.unpin",
    targetType: "poll",
    targetId: pollId,
  });

  revalidatePath(`/admin/polls/${pollId}`);
  revalidatePath("/");
}

export async function adminToggleFeatured(pollId: string, next: boolean) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase
    .from("polls")
    .update({ is_featured: next })
    .eq("id", pollId);
  if (error) throw new Error(error.message);

  await logAdminAction(supabase, {
    adminId,
    action: next ? "poll.feature" : "poll.unfeature",
    targetType: "poll",
    targetId: pollId,
  });

  revalidatePath(`/admin/polls/${pollId}`);
  revalidatePath("/");
}

async function bucketForPollStatus(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  pollId: string
) {
  const { data: poll } = await supabase
    .from("polls")
    .select("status")
    .eq("id", pollId)
    .single();
  return poll?.status === "published" ? PUBLIC_IMAGE_BUCKET : PRIVATE_IMAGE_BUCKET;
}

export type AdminImageState = { error: string | null };

export async function adminReplaceOptionImage(
  pollId: string,
  optionId: string,
  _prevState: AdminImageState,
  formData: FormData
): Promise<AdminImageState> {
  const { supabase, adminId } = await requireAdmin();
  const image = formData.get("image");

  if (!(image instanceof File) || image.size === 0) {
    return { error: "이미지를 선택해주세요." };
  }
  if (image.size > 5 * 1024 * 1024) {
    return { error: "이미지는 5MB 이하로 올려주세요." };
  }

  const service = createServiceClient();
  const bucket = await bucketForPollStatus(supabase, pollId);

  const { data: option } = await supabase
    .from("poll_options")
    .select("image_path")
    .eq("id", optionId)
    .single();

  const path = `${pollId}/${optionId}.${extensionFor(image)}`;
  const { error: uploadError } = await service.storage
    .from(bucket)
    .upload(path, image, { contentType: image.type, upsert: true });
  if (uploadError) {
    return { error: `이미지 업로드 실패: ${uploadError.message}` };
  }

  // Clean up the old file if its path differs (e.g. extension changed).
  if (option?.image_path && option.image_path !== path) {
    await service.storage.from(bucket).remove([option.image_path]);
  }

  const { error: updateError } = await supabase
    .from("poll_options")
    .update({ image_path: path })
    .eq("id", optionId);
  if (updateError) {
    return { error: updateError.message };
  }

  await logAdminAction(supabase, {
    adminId,
    action: "poll_option.replace_image",
    targetType: "poll_options",
    targetId: optionId,
  });

  revalidatePath(`/admin/polls/${pollId}`);
  revalidatePath(`/polls/${pollId}`);
  return { error: null };
}

export async function adminRemoveOptionImage(pollId: string, optionId: string) {
  const { supabase, adminId } = await requireAdmin();
  const service = createServiceClient();
  const bucket = await bucketForPollStatus(supabase, pollId);

  const { data: option } = await supabase
    .from("poll_options")
    .select("image_path")
    .eq("id", optionId)
    .single();

  if (option?.image_path) {
    await service.storage.from(bucket).remove([option.image_path]);
  }

  const { error } = await supabase
    .from("poll_options")
    .update({ image_path: null })
    .eq("id", optionId);
  if (error) throw new Error(error.message);

  await logAdminAction(supabase, {
    adminId,
    action: "poll_option.remove_image",
    targetType: "poll_options",
    targetId: optionId,
  });

  revalidatePath(`/admin/polls/${pollId}`);
  revalidatePath(`/polls/${pollId}`);
}
