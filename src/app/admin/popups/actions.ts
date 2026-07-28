"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { SITE_CONTENT_BUCKET } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { kstDatetimeLocalToUtcIso } from "@/lib/datetime";
import { toOptimizedWebp } from "@/lib/image-processing";

export type PopupFormState = { error: string | null };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
      starts_at: kstDatetimeLocalToUtcIso(startsAtInput),
      ends_at: kstDatetimeLocalToUtcIso(endsAtInput),
    })
    .select("id")
    .single();

  if (insertError || !popup) {
    return { error: insertError?.message ?? "팝업 등록에 실패했습니다." };
  }

  if (image instanceof File && image.size > 0) {
    const optimized = await toOptimizedWebp(await image.arrayBuffer(), { maxWidth: 1200 });
    const path = `popups/${popup.id}.webp`;
    const { error: uploadError } = await supabase.storage
      .from(SITE_CONTENT_BUCKET)
      .upload(path, optimized, { contentType: "image/webp", upsert: true });

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
  revalidateTag("home-portal", { expire: 0 });
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
    before: { is_active: !isActive },
    after: { is_active: isActive },
  });

  revalidatePath("/admin/popups");
  revalidatePath("/");
  revalidateTag("home-portal", { expire: 0 });
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
  revalidateTag("home-portal", { expire: 0 });
}
