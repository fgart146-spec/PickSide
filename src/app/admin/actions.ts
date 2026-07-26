"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceClient,
  PRIVATE_IMAGE_BUCKET,
  PUBLIC_IMAGE_BUCKET,
} from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new Error("관리자만 수행할 수 있습니다.");
  }

  return { supabase, adminId: user.id };
}

async function promoteImagesToPublic(pollId: string) {
  const service = createServiceClient();

  const { data: options } = await service
    .from("poll_options")
    .select("id, image_path")
    .eq("poll_id", pollId);

  for (const option of options ?? []) {
    if (!option.image_path) continue;

    const { data: file, error: downloadError } = await service.storage
      .from(PRIVATE_IMAGE_BUCKET)
      .download(option.image_path);

    if (downloadError || !file) continue;

    const { error: uploadError } = await service.storage
      .from(PUBLIC_IMAGE_BUCKET)
      .upload(option.image_path, file, { upsert: true, contentType: file.type });

    if (uploadError) continue;

    await service.storage.from(PRIVATE_IMAGE_BUCKET).remove([option.image_path]);
  }
}

export async function approvePoll(pollId: string) {
  const { supabase, adminId } = await requireAdmin();

  await promoteImagesToPublic(pollId);

  const { error } = await supabase
    .from("polls")
    .update({ status: "published" })
    .eq("id", pollId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: "poll.approve",
    targetType: "poll",
    targetId: pollId,
  });

  // If this poll came from an AI draft, reflect the go-live on the draft.
  await createServiceClient()
    .from("ai_poll_drafts")
    .update({ status: "published" })
    .eq("poll_id", pollId);

  revalidatePath("/admin/polls");
  revalidatePath("/admin/office/drafts");
  revalidatePath("/");
  revalidatePath(`/polls/${pollId}`);
  revalidateTag("home-portal", { expire: 0 });
}

export async function rejectPoll(pollId: string) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase
    .from("polls")
    .update({ status: "rejected" })
    .eq("id", pollId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: "poll.reject",
    targetType: "poll",
    targetId: pollId,
  });

  revalidatePath("/admin/polls");
  revalidatePath("/");
  revalidatePath(`/polls/${pollId}`);
  revalidateTag("home-portal", { expire: 0 });
}

export async function adminDeletePoll(pollId: string) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase
    .from("polls")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", pollId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: "poll.delete",
    targetType: "poll",
    targetId: pollId,
  });

  revalidatePath("/admin/polls");
  revalidatePath("/admin/trash");
  revalidatePath("/");
  revalidateTag("home-portal", { expire: 0 });
}

async function setReportStatus(
  reportId: string,
  status: "resolved" | "dismissed",
  formData: FormData
) {
  const { supabase, adminId } = await requireAdmin();
  const resolutionNote = String(formData.get("reason") ?? "").trim() || null;

  const { error } = await supabase
    .from("reports")
    .update({ status, resolution_note: resolutionNote })
    .eq("id", reportId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: `report.${status}`,
    targetType: "report",
    targetId: reportId,
    reason: resolutionNote,
  });

  revalidatePath("/admin/reports");
}

export async function resolveReport(reportId: string, formData: FormData) {
  await setReportStatus(reportId, "resolved", formData);
}

export async function dismissReport(reportId: string, formData: FormData) {
  await setReportStatus(reportId, "dismissed", formData);
}

// ---------------------------------------------------------------------------
// Trash: restore / permanently delete soft-deleted content.
// ---------------------------------------------------------------------------

type TrashTable = "polls" | "comments" | "community_posts" | "community_comments";

async function restore(table: TrashTable, id: string) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase.from(table).update({ deleted_at: null }).eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: `${table}.restore`,
    targetType: table,
    targetId: id,
  });

  revalidatePath("/admin/trash");
}

async function permanentlyDelete(table: TrashTable, id: string) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: `${table}.permanent_delete`,
    targetType: table,
    targetId: id,
  });

  revalidatePath("/admin/trash");
}

export async function restorePoll(id: string) {
  await restore("polls", id);
  revalidatePath("/admin/polls");
  revalidatePath("/");
}
export async function permanentlyDeletePoll(id: string) {
  await permanentlyDelete("polls", id);
}

export async function restoreComment(id: string) {
  await restore("comments", id);
}
export async function permanentlyDeleteComment(id: string) {
  await permanentlyDelete("comments", id);
}

export async function restoreCommunityPost(id: string) {
  await restore("community_posts", id);
}
export async function permanentlyDeleteCommunityPost(id: string) {
  await permanentlyDelete("community_posts", id);
}

export async function restoreCommunityComment(id: string) {
  await restore("community_comments", id);
}
export async function permanentlyDeleteCommunityComment(id: string) {
  await permanentlyDelete("community_comments", id);
}
