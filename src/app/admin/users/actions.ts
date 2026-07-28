"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { logAdminAction } from "@/lib/audit";

const DURATION_DAYS: Record<string, number> = { "1": 1, "3": 3, "7": 7, "30": 30 };

async function assertModerationTarget(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  adminId: string,
  userId: string
) {
  if (userId === adminId) {
    throw new Error("자기 자신은 정지/차단할 수 없습니다.");
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  if (target?.is_admin) {
    throw new Error("관리자 계정은 정지/차단할 수 없습니다.");
  }
}

export async function suspendUser(userId: string, formData: FormData) {
  const { supabase, adminId } = await requireAdmin();
  await assertModerationTarget(supabase, adminId, userId);

  const days = DURATION_DAYS[String(formData.get("days") ?? "")];
  if (!days) {
    throw new Error("정지 기간을 선택해주세요.");
  }
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data: existing } = await supabase
    .from("profiles")
    .select("suspended_until, suspend_reason")
    .eq("id", userId)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update({ suspended_until: until, suspend_reason: reason })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: "user.suspend",
    targetType: "profiles",
    targetId: userId,
    reason: reason ? `${days}일 정지 - ${reason}` : `${days}일 정지`,
    before: existing,
    after: { suspended_until: until, suspend_reason: reason },
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function unsuspendUser(userId: string) {
  const { supabase, adminId } = await requireAdmin();

  const { data: existing } = await supabase
    .from("profiles")
    .select("suspended_until, suspend_reason")
    .eq("id", userId)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update({ suspended_until: null, suspend_reason: null })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: "user.unsuspend",
    targetType: "profiles",
    targetId: userId,
    before: existing,
    after: { suspended_until: null, suspend_reason: null },
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function banUser(userId: string, formData: FormData) {
  const { supabase, adminId } = await requireAdmin();
  await assertModerationTarget(supabase, adminId, userId);

  const reason = String(formData.get("reason") ?? "").trim() || null;

  const { data: existing } = await supabase
    .from("profiles")
    .select("banned_at, suspend_reason")
    .eq("id", userId)
    .single();

  const bannedAt = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({ banned_at: bannedAt, suspend_reason: reason })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: "user.ban",
    targetType: "profiles",
    targetId: userId,
    reason,
    before: existing,
    after: { banned_at: bannedAt, suspend_reason: reason },
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function unbanUser(userId: string) {
  const { supabase, adminId } = await requireAdmin();

  const { data: existing } = await supabase
    .from("profiles")
    .select("banned_at, suspend_reason")
    .eq("id", userId)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update({ banned_at: null, suspend_reason: null })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: "user.unban",
    targetType: "profiles",
    targetId: userId,
    before: existing,
    after: { banned_at: null, suspend_reason: null },
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}
