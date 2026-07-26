import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function logAdminAction(
  supabase: SupabaseClient<Database>,
  params: {
    adminId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    reason?: string | null;
  }
) {
  await supabase.from("audit_log").insert({
    admin_id: params.adminId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId ?? null,
    reason: params.reason ?? null,
  });
}
