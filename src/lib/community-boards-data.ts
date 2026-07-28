import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import type { CommunityBoardRow } from "@/lib/community-boards";

const SELECT =
  "id, name, slug, description, icon, color, display_order, is_visible, allow_posts, allow_comments, allow_images, allow_anonymous, allow_guest_view, admin_only_posting, is_system, is_deleted";

async function loadVisibleBoards(): Promise<CommunityBoardRow[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("community_boards")
    .select(SELECT)
    .eq("is_visible", true)
    .eq("is_deleted", false)
    .order("display_order", { ascending: true });
  return data ?? [];
}

// Board admin actions call revalidateTag("community-boards") so a change
// shows up on the next request instead of waiting out the TTL.
export const getVisibleBoards = unstable_cache(loadVisibleBoards, ["visible-community-boards"], {
  revalidate: 60,
  tags: ["community-boards"],
});

async function loadBoardBySlug(slug: string): Promise<CommunityBoardRow | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("community_boards")
    .select(SELECT)
    .eq("slug", slug)
    .eq("is_deleted", false)
    .single();
  return data;
}

/** Looks up a board by slug regardless of is_visible — callers decide access based on that + isAdmin. */
export const getBoardBySlug = unstable_cache(loadBoardBySlug, ["community-board-by-slug"], {
  revalidate: 60,
  tags: ["community-boards"],
});
