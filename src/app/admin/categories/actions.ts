"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import {
  slugifyCategoryName,
  isPollCategory,
  UNCATEGORIZED_SLUG,
  type PollCategory,
} from "@/lib/categories";

export type CategoryFormState = { error: string | null };

function revalidateCategoryConsumers() {
  revalidatePath("/admin/categories");
  revalidatePath("/");
  revalidatePath("/polls/new");
  revalidateTag("home-portal", { expire: 0 });
}

async function uniqueSlug(
  supabase: ReturnType<typeof createServiceClient>,
  desired: string,
  excludeId?: string
): Promise<string> {
  let candidate = desired;
  let suffix = 1;
  for (;;) {
    let q = supabase
      .from("categories")
      .select("id")
      .eq("slug", candidate)
      .eq("is_deleted", false);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
    suffix += 1;
    candidate = `${desired}-${suffix}`;
  }
}

export async function createCategory(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const isVisible = formData.get("is_visible") === "on";
  const showOnHome = formData.get("show_on_home") === "on";

  if (!name) {
    return { error: "카테고리 이름을 입력해주세요." };
  }

  const slug = await uniqueSlug(service, slugifyCategoryName(slugInput || name));

  const { count } = await service
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("is_deleted", false);
  const displayOrder = count ?? 0;

  const { data: category, error } = await service
    .from("categories")
    .insert({
      name,
      slug,
      description,
      icon,
      color,
      is_visible: isVisible,
      show_on_home: showOnHome,
      display_order: displayOrder,
    })
    .select("id")
    .single();

  if (error || !category) {
    return { error: error?.message ?? "카테고리 생성에 실패했습니다." };
  }

  await logAdminAction(service, {
    adminId,
    action: "category.create",
    targetType: "categories",
    targetId: category.id,
    reason: `이름: ${name}, slug: ${slug}`,
  });

  revalidateCategoryConsumers();
  return { error: null };
}

export async function updateCategory(
  id: string,
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const isVisible = formData.get("is_visible") === "on";
  const showOnHome = formData.get("show_on_home") === "on";

  if (!name) {
    return { error: "카테고리 이름을 입력해주세요." };
  }

  const { data: existing } = await service
    .from("categories")
    .select("name, slug, description, icon, color, is_visible, show_on_home")
    .eq("id", id)
    .single();

  const desiredSlug = slugifyCategoryName(slugInput || name);
  const slug =
    desiredSlug === existing?.slug ? existing.slug : await uniqueSlug(service, desiredSlug, id);

  const after = {
    name,
    slug,
    description,
    icon,
    color,
    is_visible: isVisible,
    show_on_home: showOnHome,
  };

  const { error } = await service
    .from("categories")
    .update({ ...after, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  await logAdminAction(service, {
    adminId,
    action: "category.update",
    targetType: "categories",
    targetId: id,
    reason: `이름: ${name}, slug: ${slug}`,
    before: existing,
    after,
  });

  revalidateCategoryConsumers();
  return { error: null };
}

export async function toggleCategoryVisibility(id: string, isVisible: boolean) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const { error } = await service
    .from("categories")
    .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await logAdminAction(service, {
    adminId,
    action: isVisible ? "category.show" : "category.hide",
    targetType: "categories",
    targetId: id,
    before: { is_visible: !isVisible },
    after: { is_visible: isVisible },
  });

  revalidateCategoryConsumers();
}

export async function toggleShowOnHome(id: string, showOnHome: boolean) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const { error } = await service
    .from("categories")
    .update({ show_on_home: showOnHome, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await logAdminAction(service, {
    adminId,
    action: showOnHome ? "category.show_on_home" : "category.hide_from_home",
    targetType: "categories",
    targetId: id,
    before: { show_on_home: !showOnHome },
    after: { show_on_home: showOnHome },
  });

  revalidateCategoryConsumers();
}

/** Persists a full drag-and-drop reorder: `orderedIds` is the new top-to-bottom order. */
export async function reorderCategories(orderedIds: string[]) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  await Promise.all(
    orderedIds.map((id, index) =>
      service
        .from("categories")
        .update({ display_order: index, updated_at: new Date().toISOString() })
        .eq("id", id)
    )
  );

  await logAdminAction(service, {
    adminId,
    action: "category.reorder",
    targetType: "categories",
    targetId: null,
    reason: orderedIds.join(" > "),
  });

  revalidateCategoryConsumers();
}

/**
 * Soft-deletes a category and moves its polls to `reassignToId` (defaults to
 * the system 미분류 bucket). Refuses to delete a system category (미분류
 * itself), matching the "can't be deleted" requirement.
 */
export async function deleteCategory(id: string, formData: FormData) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const { data: target } = await service
    .from("categories")
    .select("id, name, is_system")
    .eq("id", id)
    .single();

  if (!target) throw new Error("카테고리를 찾을 수 없습니다.");
  if (target.is_system) throw new Error("시스템 카테고리는 삭제할 수 없습니다.");

  const reassignToId = String(formData.get("reassign_to") ?? "").trim();

  const { data: fallback } = await service
    .from("categories")
    .select("id, name")
    .eq("slug", UNCATEGORIZED_SLUG)
    .single();

  const destination = reassignToId
    ? (await service.from("categories").select("id, name").eq("id", reassignToId).single()).data
    : fallback;

  if (!destination) throw new Error("이동할 카테고리를 찾을 수 없습니다.");

  // polls.category_id moves to the destination outright. The legacy enum
  // column can only hold one of the original 6 Korean values, so it's only
  // updated when the destination happens to be one of those; otherwise it's
  // left as-is (display-only fallback for old code paths, category_id is
  // authoritative everywhere this migration wires up).
  const legacyUpdate: { category_id: string; category?: PollCategory } = {
    category_id: destination.id,
  };
  if (isPollCategory(destination.name)) {
    legacyUpdate.category = destination.name;
  }

  const { error: reassignError } = await service
    .from("polls")
    .update(legacyUpdate)
    .eq("category_id", id);
  if (reassignError) throw new Error(reassignError.message);

  const { error: deleteError } = await service
    .from("categories")
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (deleteError) throw new Error(deleteError.message);

  await logAdminAction(service, {
    adminId,
    action: "category.delete",
    targetType: "categories",
    targetId: id,
    reason: `"${target.name}" 삭제, 투표는 "${destination.name}"(으)로 이동`,
  });

  revalidateCategoryConsumers();
}

export async function restoreCategory(id: string) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const { data: target } = await service
    .from("categories")
    .select("id, name, slug")
    .eq("id", id)
    .single();
  if (!target) throw new Error("카테고리를 찾을 수 없습니다.");

  const slug = await uniqueSlug(service, target.slug, id);

  const { error } = await service
    .from("categories")
    .update({ is_deleted: false, slug, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await logAdminAction(service, {
    adminId,
    action: "category.restore",
    targetType: "categories",
    targetId: id,
    reason: slug !== target.slug ? `slug가 "${target.slug}"에서 "${slug}"로 조정됨` : null,
  });

  revalidateCategoryConsumers();
}
