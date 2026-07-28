"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import {
  slugifyBoardName,
  isCommunityBoard,
  ARCHIVE_BOARD_SLUG,
  type CommunityBoard,
} from "@/lib/community-boards";

export type BoardFormState = { error: string | null };

function revalidateBoardConsumers() {
  revalidatePath("/admin/community/boards");
  revalidatePath("/community");
  revalidateTag("community-boards", { expire: 0 });
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
      .from("community_boards")
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

function boardFieldsFrom(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    slugInput: String(formData.get("slug") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    icon: String(formData.get("icon") ?? "").trim() || null,
    color: String(formData.get("color") ?? "").trim() || null,
    is_visible: formData.get("is_visible") === "on",
    allow_posts: formData.get("allow_posts") === "on",
    allow_comments: formData.get("allow_comments") === "on",
    allow_images: formData.get("allow_images") === "on",
    allow_anonymous: formData.get("allow_anonymous") === "on",
    allow_guest_view: formData.get("allow_guest_view") === "on",
    admin_only_posting: formData.get("admin_only_posting") === "on",
  };
}

export async function createBoard(
  _prevState: BoardFormState,
  formData: FormData
): Promise<BoardFormState> {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();
  const f = boardFieldsFrom(formData);

  if (!f.name) {
    return { error: "게시판 이름을 입력해주세요." };
  }

  const slug = await uniqueSlug(service, slugifyBoardName(f.slugInput || f.name));

  const { count } = await service
    .from("community_boards")
    .select("id", { count: "exact", head: true })
    .eq("is_deleted", false);

  const { data: board, error } = await service
    .from("community_boards")
    .insert({
      name: f.name,
      slug,
      description: f.description,
      icon: f.icon,
      color: f.color,
      is_visible: f.is_visible,
      allow_posts: f.allow_posts,
      allow_comments: f.allow_comments,
      allow_images: f.allow_images,
      allow_anonymous: f.allow_anonymous,
      allow_guest_view: f.allow_guest_view,
      admin_only_posting: f.admin_only_posting,
      display_order: count ?? 0,
    })
    .select("id")
    .single();

  if (error || !board) {
    return { error: error?.message ?? "게시판 생성에 실패했습니다." };
  }

  await logAdminAction(service, {
    adminId,
    action: "board.create",
    targetType: "community_boards",
    targetId: board.id,
    reason: `이름: ${f.name}, slug: ${slug}`,
  });

  revalidateBoardConsumers();
  return { error: null };
}

export async function updateBoard(
  id: string,
  _prevState: BoardFormState,
  formData: FormData
): Promise<BoardFormState> {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();
  const f = boardFieldsFrom(formData);

  if (!f.name) {
    return { error: "게시판 이름을 입력해주세요." };
  }

  const { data: existing } = await service
    .from("community_boards")
    .select(
      "name, slug, description, icon, color, is_visible, allow_posts, allow_comments, allow_images, allow_anonymous, allow_guest_view, admin_only_posting"
    )
    .eq("id", id)
    .single();

  const desiredSlug = slugifyBoardName(f.slugInput || f.name);
  const slug =
    desiredSlug === existing?.slug ? existing.slug : await uniqueSlug(service, desiredSlug, id);

  const after = {
    name: f.name,
    slug,
    description: f.description,
    icon: f.icon,
    color: f.color,
    is_visible: f.is_visible,
    allow_posts: f.allow_posts,
    allow_comments: f.allow_comments,
    allow_images: f.allow_images,
    allow_anonymous: f.allow_anonymous,
    allow_guest_view: f.allow_guest_view,
    admin_only_posting: f.admin_only_posting,
  };

  const { error } = await service
    .from("community_boards")
    .update({ ...after, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  await logAdminAction(service, {
    adminId,
    action: "board.update",
    targetType: "community_boards",
    targetId: id,
    reason: `이름: ${f.name}, slug: ${slug}`,
    before: existing,
    after,
  });

  revalidateBoardConsumers();
  return { error: null };
}

export async function toggleBoardVisibility(id: string, isVisible: boolean) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const { error } = await service
    .from("community_boards")
    .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await logAdminAction(service, {
    adminId,
    action: isVisible ? "board.show" : "board.hide",
    targetType: "community_boards",
    targetId: id,
    before: { is_visible: !isVisible },
    after: { is_visible: isVisible },
  });

  revalidateBoardConsumers();
}

export async function reorderBoards(orderedIds: string[]) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  await Promise.all(
    orderedIds.map((id, index) =>
      service
        .from("community_boards")
        .update({ display_order: index, updated_at: new Date().toISOString() })
        .eq("id", id)
    )
  );

  await logAdminAction(service, {
    adminId,
    action: "board.reorder",
    targetType: "community_boards",
    targetId: null,
    reason: orderedIds.join(" > "),
  });

  revalidateBoardConsumers();
}

/**
 * Soft-deletes a board and moves its posts to `reassignToId` (defaults to
 * the system 보관 archive board). Refuses to delete a system board.
 */
export async function deleteBoard(id: string, formData: FormData) {
  const { supabase, adminId } = await requireAdmin();
  const service = createServiceClient();

  const { data: target } = await service
    .from("community_boards")
    .select("id, name, is_system")
    .eq("id", id)
    .single();

  if (!target) throw new Error("게시판을 찾을 수 없습니다.");
  if (target.is_system) throw new Error("시스템 게시판은 삭제할 수 없습니다.");

  const reassignToId = String(formData.get("reassign_to") ?? "").trim();

  const { data: fallback } = await service
    .from("community_boards")
    .select("id, name, slug")
    .eq("slug", ARCHIVE_BOARD_SLUG)
    .single();

  const destination = reassignToId
    ? (await service.from("community_boards").select("id, name, slug").eq("id", reassignToId).single())
        .data
    : fallback;

  if (!destination) throw new Error("이동할 게시판을 찾을 수 없습니다.");

  // The legacy enum column can only hold one of the original 4 values —
  // only updated when the destination happens to be one of those, otherwise
  // left as-is (board_id is authoritative everywhere this migration wires
  // up; the enum is a display-only fallback for old code paths).
  const legacyUpdate: { board_id: string; board?: CommunityBoard } = {
    board_id: destination.id,
  };
  if (isCommunityBoard(destination.slug)) {
    legacyUpdate.board = destination.slug;
  }

  // community_posts was never granted to service_role (only anon/authenticated,
  // see 20260726000014), so this goes through the request-scoped client —
  // covered by the "Admins can update any community post" RLS policy.
  const { error: reassignError } = await supabase
    .from("community_posts")
    .update(legacyUpdate)
    .eq("board_id", id);
  if (reassignError) throw new Error(reassignError.message);

  const { error: deleteError } = await service
    .from("community_boards")
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (deleteError) throw new Error(deleteError.message);

  await logAdminAction(service, {
    adminId,
    action: "board.delete",
    targetType: "community_boards",
    targetId: id,
    reason: `"${target.name}" 삭제, 게시글은 "${destination.name}"(으)로 이동`,
  });

  revalidateBoardConsumers();
}

export async function restoreBoard(id: string) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();

  const { data: target } = await service
    .from("community_boards")
    .select("id, name, slug")
    .eq("id", id)
    .single();
  if (!target) throw new Error("게시판을 찾을 수 없습니다.");

  const slug = await uniqueSlug(service, target.slug, id);

  const { error } = await service
    .from("community_boards")
    .update({ is_deleted: false, slug, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await logAdminAction(service, {
    adminId,
    action: "board.restore",
    targetType: "community_boards",
    targetId: id,
    reason: slug !== target.slug ? `slug가 "${target.slug}"에서 "${slug}"로 조정됨` : null,
  });

  revalidateBoardConsumers();
}
