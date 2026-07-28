"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { logAdminAction } from "@/lib/audit";

type ReportSource = "poll" | "community";
type ContentType = "poll" | "comment" | "post";

/**
 * One-click moderation from the unified reports screen: soft-deletes the
 * reported content and resolves the report in a single action, instead of
 * requiring the admin to separately visit the poll/board and delete it
 * there before coming back to close out the report.
 */
export async function deleteReportedContentAndResolve(
  source: ReportSource,
  contentType: ContentType,
  reportId: string,
  contentId: string
) {
  const { supabase, adminId } = await requireAdmin();
  const now = new Date().toISOString();

  let table: string;
  if (source === "poll" && contentType === "poll") {
    table = "polls";
    const { error } = await supabase.from("polls").update({ deleted_at: now }).eq("id", contentId);
    if (error) throw new Error(error.message);
  } else if (source === "poll" && contentType === "comment") {
    table = "comments";
    const { error } = await supabase.from("comments").update({ deleted_at: now }).eq("id", contentId);
    if (error) throw new Error(error.message);
  } else if (source === "community" && contentType === "post") {
    table = "community_posts";
    const { error } = await supabase
      .from("community_posts")
      .update({ deleted_at: now })
      .eq("id", contentId);
    if (error) throw new Error(error.message);
  } else if (source === "community" && contentType === "comment") {
    table = "community_comments";
    const { error } = await supabase
      .from("community_comments")
      .update({ deleted_at: now })
      .eq("id", contentId);
    if (error) throw new Error(error.message);
  } else {
    throw new Error("잘못된 신고 대상입니다.");
  }

  const reportTable = source === "poll" ? "reports" : "community_reports";
  const { error: reportError } = await supabase
    .from(reportTable)
    .update({ status: "resolved", resolution_note: "게시물 삭제됨" })
    .eq("id", reportId);
  if (reportError) throw new Error(reportError.message);

  await logAdminAction(supabase, {
    adminId,
    action: `${table}.delete_via_report`,
    targetType: table,
    targetId: contentId,
    reason: `신고(${reportId}) 처리를 위해 삭제`,
  });

  revalidatePath("/admin/reports");
  revalidatePath("/admin/trash");
}
