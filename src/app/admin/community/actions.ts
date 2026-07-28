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

  const { data: existing } = await supabase
    .from("community_reports")
    .select("status, resolution_note")
    .eq("id", reportId)
    .single();

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
    before: existing,
    after: { status, resolution_note: resolutionNote },
  });

  revalidatePath("/admin/reports");
}

export async function resolveCommunityReport(reportId: string, formData: FormData) {
  await setCommunityReportStatus(reportId, "resolved", formData);
}

export async function dismissCommunityReport(reportId: string, formData: FormData) {
  await setCommunityReportStatus(reportId, "dismissed", formData);
}

export async function toggleCommunityPostPin(postId: string, next: boolean) {
  const { supabase, adminId } = await requireAdmin();

  const { data: post } = await supabase
    .from("community_posts")
    .select("community_boards!community_posts_board_id_fkey(slug)")
    .eq("id", postId)
    .single();
  const boardSlug = (post as unknown as { community_boards: { slug: string } | null } | null)
    ?.community_boards?.slug;

  const { error } = await supabase
    .from("community_posts")
    .update({ is_pinned: next, updated_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw new Error(error.message);

  await logAdminAction(supabase, {
    adminId,
    action: next ? "community_post.pin" : "community_post.unpin",
    targetType: "community_posts",
    targetId: postId,
    before: { is_pinned: !next },
    after: { is_pinned: next },
  });

  revalidatePath("/admin/community/posts");
  if (boardSlug) {
    revalidatePath(`/community/${boardSlug}`);
    revalidatePath(`/community/${boardSlug}/${postId}`);
  }
}
