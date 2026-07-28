import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";

export async function logAdminAction(
  supabase: SupabaseClient<Database>,
  params: {
    adminId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    reason?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  }
) {
  const { error } = await supabase.from("audit_log").insert({
    admin_id: params.adminId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId ?? null,
    reason: params.reason ?? null,
    before_value: (params.before as Json) ?? null,
    after_value: (params.after as Json) ?? null,
  });

  // A failed audit write must never break the admin action it's logging —
  // but silently swallowing it made a real service_role grant bug invisible
  // for two entire steps' worth of testing, so at least surface it in logs.
  if (error) {
    console.error("logAdminAction failed:", error.message, params);
  }
}
