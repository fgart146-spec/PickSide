"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { logAdminAction } from "@/lib/audit";

export async function toggleSectionVisibility(key: string, isVisible: boolean) {
  const { supabase, adminId } = await requireAdmin();

  const { error } = await supabase
    .from("home_sections")
    .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
    .eq("key", key);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: isVisible ? "home_section.show" : "home_section.hide",
    targetType: "home_sections",
    targetId: key,
  });

  revalidatePath("/admin/home-sections");
  revalidatePath("/");
}

export async function moveSection(key: string, direction: "up" | "down") {
  const { supabase, adminId } = await requireAdmin();

  const { data: sections } = await supabase
    .from("home_sections")
    .select("key, sort_order")
    .order("sort_order", { ascending: true });

  if (!sections) return;

  const index = sections.findIndex((s) => s.key === key);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= sections.length) return;

  const current = sections[index];
  const swapWith = sections[swapIndex];

  const { error: error1 } = await supabase
    .from("home_sections")
    .update({ sort_order: swapWith.sort_order, updated_at: new Date().toISOString() })
    .eq("key", current.key);
  const { error: error2 } = await supabase
    .from("home_sections")
    .update({ sort_order: current.sort_order, updated_at: new Date().toISOString() })
    .eq("key", swapWith.key);

  if (error1 || error2) {
    throw new Error(error1?.message ?? error2?.message);
  }

  await logAdminAction(supabase, {
    adminId,
    action: "home_section.reorder",
    targetType: "home_sections",
    targetId: key,
    reason: `${direction} (swapped with ${swapWith.key})`,
  });

  revalidatePath("/admin/home-sections");
  revalidatePath("/");
}
