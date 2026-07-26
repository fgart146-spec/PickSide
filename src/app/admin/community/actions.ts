"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { logAdminAction } from "@/lib/audit";

async function setCommunityReportStatus(
  reportId: string,
  status: "resolved" | "dismissed",
  formData: FormData
) {
  const { supabase, adminId } = await requireAdmin();
  const resolutionNote = String(formData.get("reason") ?? "").trim() || null;

  const { error } = await supabase
    .from("community_reports")
    .update({ status, resolution_note: resolutionNote })
    .eq("id", reportId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: `community_report.${status}`,
    targetType: "community_report",
    targetId: reportId,
    reason: resolutionNote,
  });

  revalidatePath("/admin/reports");
}

export async function resolveCommunityReport(reportId: string, formData: FormData) {
  await setCommunityReportStatus(reportId, "resolved", formData);
}

export async function dismissCommunityReport(reportId: string, formData: FormData) {
  await setCommunityReportStatus(reportId, "dismissed", formData);
}
