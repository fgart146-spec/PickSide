"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { logAdminAction } from "@/lib/audit";

export type PolicyFormState = { error: string | null };

export async function updatePolicyDocument(
  slug: string,
  _prevState: PolicyFormState,
  formData: FormData
): Promise<PolicyFormState> {
  const { supabase, adminId } = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title || !body) {
    return { error: "제목과 내용을 모두 입력해주세요." };
  }

  const { data: existing } = await supabase
    .from("policy_documents")
    .select("title, body")
    .eq("slug", slug)
    .single();

  const { error } = await supabase
    .from("policy_documents")
    .update({ title, body, updated_at: new Date().toISOString(), updated_by: adminId })
    .eq("slug", slug);

  if (error) {
    return { error: error.message };
  }

  await logAdminAction(supabase, {
    adminId,
    action: "policy_document.update",
    targetType: "policy_documents",
    targetId: slug,
    before: existing,
    after: { title, body },
  });

  revalidatePath("/admin/policies");
  revalidatePath(`/${slug}`);
  return { error: null };
}
