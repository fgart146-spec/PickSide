import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function suspensionMessage(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("banned_at, suspended_until")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  if (profile.banned_at) {
    return "영구 정지된 계정입니다.";
  }

  if (profile.suspended_until && new Date(profile.suspended_until) > new Date()) {
    const until = new Date(profile.suspended_until).toLocaleString("ko-KR");
    return `계정이 일시 정지되었습니다. (${until}까지)`;
  }

  return null;
}
