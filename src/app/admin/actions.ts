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

// Trash mutations run with the service-role client: the caller is already
// verified as an admin, and there is no admin-level RLS policy for hard
// DELETE on these tables, so the RLS-bound cookie client would silently
// delete zero rows and leave items stuck in the trash.
async function restore(table: TrashTable, id: string) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const { error } = await service.from(table).update({ deleted_at: null }).eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(service, {
    adminId,
    action: `${table}.restore`,
    targetType: table,
    targetId: id,
  });

  revalidatePath("/admin/trash");
}

async function permanentlyDelete(table: TrashTable, id: string) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const { error } = await service.from(table).delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(service, {
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

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------

async function revalidateAfterTrashChange(table: TrashTable) {
  revalidatePath("/admin/trash");
  if (table === "polls") {
    revalidatePath("/admin/polls");
    revalidatePath("/");
    revalidateTag("home-portal", { expire: 0 });
  }
}

/** Restore every trashed row of one type. */
export async function restoreAllTrash(table: TrashTable) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const { error } = await service
    .from(table)
    .update({ deleted_at: null })
    .not("deleted_at", "is", null);
  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(service, {
    adminId,
    action: `${table}.restore_all`,
    targetType: table,
    targetId: null,
  });

  await revalidateAfterTrashChange(table);
}

/** Permanently delete every trashed row of one type. */
export async function permanentlyDeleteAllTrash(table: TrashTable) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const { error } = await service.from(table).delete().not("deleted_at", "is", null);
  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(service, {
    adminId,
    action: `${table}.permanent_delete_all`,
    targetType: table,
    targetId: null,
  });

  await revalidateAfterTrashChange(table);
}

/** Approve every pending poll at once (mirrors approvePoll for each). */
export async function approveAllPending() {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const { data: pendings } = await service
    .from("polls")
    .select("id")
    .eq("status", "pending")
    .is("deleted_at", null);

  const ids = (pendings ?? []).map((p) => p.id);
  if (ids.length === 0) return;

  // Move each poll's images into the public bucket before publishing.
  for (const id of ids) {
    await promoteImagesToPublic(id);
  }

  const { error } = await service
    .from("polls")
    .update({ status: "published" })
    .in("id", ids);
  if (error) {
    throw new Error(error.message);
  }

  await service.from("ai_poll_drafts").update({ status: "published" }).in("poll_id", ids);

  await logAdminAction(service, {
    adminId,
    action: "poll.approve_all",
    targetType: "poll",
    targetId: null,
    reason: `${ids.length}건 일괄 승인`,
  });

  revalidatePath("/admin/polls");
  revalidatePath("/admin/office/drafts");
  revalidatePath("/");
  revalidateTag("home-portal", { expire: 0 });
}
