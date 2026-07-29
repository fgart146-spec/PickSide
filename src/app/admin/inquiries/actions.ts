"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { INQUIRY_STATUSES } from "@/lib/inquiries";

export type InquiryNoteState = { error: string | null };

async function setInquiryStatus(inquiryId: string, status: string) {
  const { adminId } = await requireAdmin();
  if (!(INQUIRY_STATUSES as readonly string[]).includes(status)) {
    throw new Error("올바르지 않은 상태입니다.");
  }

  const service = createServiceClient();
  const { data: existing } = await service
    .from("inquiries")
    .select("status")
    .eq("id", inquiryId)
    .single();

  const { error } = await service
    .from("inquiries")
    .update({ status })
    .eq("id", inquiryId);
  if (error) throw new Error(error.message);

  await logAdminAction(service, {
    adminId,
    action: "inquiry.status_update",
    targetType: "inquiries",
    targetId: inquiryId,
    before: { status: existing?.status },
    after: { status },
  });

  revalidatePath(`/admin/inquiries/${inquiryId}`);
  revalidatePath("/admin/inquiries");
}

/** Plain form-action wrapper — reads `status` from the submitted <select>
 * so the control can auto-submit its own form on change, no client state
 * or transition needed. */
export async function updateInquiryStatusForm(inquiryId: string, formData: FormData) {
  const status = String(formData.get("status") ?? "");
  await setInquiryStatus(inquiryId, status);
}

export async function updateInquiryNote(
  inquiryId: string,
  _prevState: InquiryNoteState,
  formData: FormData
): Promise<InquiryNoteState> {
  const { adminId } = await requireAdmin();
  const note = String(formData.get("adminNote") ?? "").trim();

  const service = createServiceClient();
  const { error } = await service
    .from("inquiries")
    .update({ admin_note: note || null })
    .eq("id", inquiryId);
  if (error) return { error: error.message };

  await logAdminAction(service, {
    adminId,
    action: "inquiry.note_update",
    targetType: "inquiries",
    targetId: inquiryId,
  });

  revalidatePath(`/admin/inquiries/${inquiryId}`);
  return { error: null };
}

export async function deleteInquiry(inquiryId: string) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const deletedAt = new Date().toISOString();
  const { error } = await service
    .from("inquiries")
    .update({ deleted_at: deletedAt })
    .eq("id", inquiryId);
  if (error) throw new Error(error.message);

  await logAdminAction(service, {
    adminId,
    action: "inquiry.delete",
    targetType: "inquiries",
    targetId: inquiryId,
  });

  revalidatePath("/admin/inquiries");
  revalidatePath("/admin/trash");
}
