"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { SITE_CONTENT_BUCKET } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { kstDatetimeLocalToUtcIso } from "@/lib/datetime";

export type BannerFormState = { error: string | null };

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

export async function createBanner(
  kind: "event" | "home",
  _prevState: BannerFormState,
  formData: FormData
): Promise<BannerFormState> {
  const { supabase, adminId } = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
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

  const { data: banner, error: insertError } = await supabase
    .from("banners")
    .insert({
      kind,
      title,
      link_url: linkUrl,
      starts_at: kstDatetimeLocalToUtcIso(startsAtInput),
      ends_at: kstDatetimeLocalToUtcIso(endsAtInput),
    })
    .select("id")
    .single();

  if (insertError || !banner) {
    return { error: insertError?.message ?? "배너 등록에 실패했습니다." };
  }

  if (image instanceof File && image.size > 0) {
    const path = `banners/${banner.id}.${extensionFor(image)}`;
    const { error: uploadError } = await supabase.storage
      .from(SITE_CONTENT_BUCKET)
      .upload(path, image, { contentType: image.type, upsert: true });

    if (uploadError) {
      return { error: `이미지 업로드 실패: ${uploadError.message}` };
    }

    const { error: updateError } = await supabase
      .from("banners")
      .update({ image_path: path })
      .eq("id", banner.id);

    if (updateError) {
      return { error: `이미지 경로 저장 실패: ${updateError.message}` };
    }
  }

  await logAdminAction(supabase, {
    adminId,
    action: `banner.create.${kind}`,
    targetType: "banners",
    targetId: banner.id,
    reason: title,
  });

  revalidatePath("/admin/banners");
  revalidatePath("/");
  revalidateTag("home-portal", { expire: 0 });
  return { error: null };
}

export async function toggleBannerActive(id: string, isActive: boolean) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase.from("banners").update({ is_active: isActive }).eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: isActive ? "banner.activate" : "banner.deactivate",
    targetType: "banners",
    targetId: id,
  });

  revalidatePath("/admin/banners");
  revalidatePath("/");
  revalidateTag("home-portal", { expire: 0 });
}

export async function deleteBanner(id: string) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: "banner.delete",
    targetType: "banners",
    targetId: id,
  });

  revalidatePath("/admin/banners");
  revalidatePath("/");
  revalidateTag("home-portal", { expire: 0 });
}
