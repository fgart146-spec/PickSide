"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { SITE_CONTENT_BUCKET } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { isAdSlotKey } from "@/lib/ad-slots";
import { toOptimizedWebp } from "@/lib/image-processing";

export type AdSlotFormState = { error: string | null };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function updateAdSlot(
  slotKey: string,
  _prevState: AdSlotFormState,
  formData: FormData
): Promise<AdSlotFormState> {
  if (!isAdSlotKey(slotKey)) {
    return { error: "잘못된 광고 영역입니다." };
  }

  const { supabase, adminId } = await requireAdmin();

  const { data: existing } = await supabase
    .from("ad_slots")
    .select("link_url, is_active, image_path")
    .eq("slot_key", slotKey)
    .single();

  const linkUrl = String(formData.get("link_url") ?? "").trim() || null;
  const isActive = formData.get("is_active") === "on";
  const image = formData.get("image");

  if (image instanceof File && image.size > MAX_IMAGE_BYTES) {
    return { error: "이미지는 5MB 이하로 올려주세요." };
  }

  const update: { link_url: string | null; is_active: boolean; image_path?: string } = {
    link_url: linkUrl,
    is_active: isActive,
  };

  if (image instanceof File && image.size > 0) {
    const optimized = await toOptimizedWebp(await image.arrayBuffer(), { maxWidth: 1600 });
    const path = `ad-slots/${slotKey}-${Date.now()}.webp`;
    const { error: uploadError } = await supabase.storage
      .from(SITE_CONTENT_BUCKET)
      .upload(path, optimized, { contentType: "image/webp", upsert: true });

    if (uploadError) {
      return { error: `이미지 업로드 실패: ${uploadError.message}` };
    }
    update.image_path = path;
  }

  const { error } = await supabase.from("ad_slots").update(update).eq("slot_key", slotKey);
  if (error) {
    return { error: error.message };
  }

  await logAdminAction(supabase, {
    adminId,
    action: "ad_slot.update",
    targetType: "ad_slots",
    targetId: slotKey,
    before: existing,
    after: update,
  });

  revalidatePath("/admin/ad-slots");
  revalidatePath("/");
  return { error: null };
}

export async function clearAdSlot(slotKey: string) {
  if (!isAdSlotKey(slotKey)) {
    throw new Error("잘못된 광고 영역입니다.");
  }

  const { supabase, adminId } = await requireAdmin();

  const { data: existing } = await supabase
    .from("ad_slots")
    .select("link_url, is_active, image_path")
    .eq("slot_key", slotKey)
    .single();

  const { error } = await supabase
    .from("ad_slots")
    .update({ image_path: null, link_url: null, is_active: false })
    .eq("slot_key", slotKey);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: "ad_slot.clear",
    targetType: "ad_slots",
    targetId: slotKey,
    before: existing,
    after: { image_path: null, link_url: null, is_active: false },
  });

  revalidatePath("/admin/ad-slots");
  revalidatePath("/");
}
