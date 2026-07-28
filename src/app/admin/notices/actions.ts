"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { logAdminAction } from "@/lib/audit";

export type NoticeFormState = { error: string | null };

export async function createNotice(
  _prevState: NoticeFormState,
  formData: FormData
): Promise<NoticeFormState> {
  const { supabase, adminId } = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title || !body) {
    return { error: "제목과 내용을 모두 입력해주세요." };
  }

  const { error } = await supabase.from("notices").insert({ title, body });
  if (error) {
    return { error: error.message };
  }

  await logAdminAction(supabase, {
    adminId,
    action: "notice.create",
    targetType: "notices",
    reason: title,
  });

  revalidatePath("/admin/notices");
  revalidatePath("/");
  return { error: null };
}

export async function toggleNoticeActive(id: string, isActive: boolean) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase.from("notices").update({ is_active: isActive }).eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: isActive ? "notice.activate" : "notice.deactivate",
    targetType: "notices",
    targetId: id,
    before: { is_active: !isActive },
    after: { is_active: isActive },
  });

  revalidatePath("/admin/notices");
  revalidatePath("/");
}

export async function deleteNotice(id: string) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase.from("notices").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: "notice.delete",
    targetType: "notices",
    targetId: id,
  });

  revalidatePath("/admin/notices");
  revalidatePath("/");
}
