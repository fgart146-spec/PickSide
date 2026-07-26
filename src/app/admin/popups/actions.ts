"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { SITE_CONTENT_BUCKET } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

export type PopupFormState = { error: string | null };

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

export async function createPopup(
  _prevState: PopupFormState,
  formData: FormData
): Promise<PopupFormState> {
  const { supabase, adminId } = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim() || null;
  const linkUrl = String(formData.get("link_url") ?? "").trim() || null;
  const startsAtInput = String(formData.get("starts_at") ?? "").trim();
  const endsAtInput = String(formData.get("ends_at") ?? "").trim();
  const image = formData.get("image");

  if (!title) {
    return { error: "제목을 입력해주세요." };
  }
  if (image instanceof File && image.size > MAX_IMAGE_BYTES) {
    return { error: "이미지는 5MB 이하로 올려주세요." };
  }

  const { data: popup, error: insertError } = await supabase
    .from("popups")
    .insert({
      title,
      body,
      link_url: linkUrl,
      starts_at: startsAtInput ? new Date(startsAtInput).toISOString() : null,
      ends_at: endsAtInput ? new Date(endsAtInput).toISOString() : null,
    })
    .select("id")
    .single();

  if (insertError || !popup) {
    return { error: insertError?.message ?? "팝업 등록에 실패했습니다." };
  }

  if (image instanceof File && image.size > 0) {
    const path = `popups/${popup.id}.${extensionFor(image)}`;
    const { error: uploadError } = await supabase.storage
      .from(SITE_CONTENT_BUCKET)
      .upload(path, image, { contentType: image.type, upsert: true });

    if (uploadError) {
      return { error: `이미지 업로드 실패: ${uploadError.message}` };
    }

    const { error: updateError } = await supabase
      .from("popups")
      .update({ image_path: path })
      .eq("id", popup.id);

    if (updateError) {
      return { error: `이미지 경로 저장 실패: ${updateError.message}` };
    }
  }

  await logAdminAction(supabase, {
    adminId,
    action: "popup.create",
    targetType: "popups",
    targetId: popup.id,
    reason: title,
  });

  revalidatePath("/admin/popups");
  revalidatePath("/");
  return { error: null };
}

export async function togglePopupActive(id: string, isActive: boolean) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase.from("popups").update({ is_active: isActive }).eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: isActive ? "popup.activate" : "popup.deactivate",
    targetType: "popups",
    targetId: id,
  });

  revalidatePath("/admin/popups");
  revalidatePath("/");
}

export async function deletePopup(id: string) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase.from("popups").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: "popup.delete",
    targetType: "popups",
    targetId: id,
  });

  revalidatePath("/admin/popups");
  revalidatePath("/");
}
