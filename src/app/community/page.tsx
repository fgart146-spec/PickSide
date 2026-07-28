import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getVisibleBoards } from "@/lib/community-boards-data";
import { BrowseSidebar } from "@/components/browse-sidebar";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "커뮤니티 | PickSide",
  description: "자유게시판, 유머, 고민상담까지 — PickSide 커뮤니티",
};

export default async function CommunityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.is_admin ?? false;
  }

  const visibleBoards = await getVisibleBoards();

  // Admins can also see hidden boards here (e.g. the 보관 archive board),
  // matching how they can reach them directly by URL.
  let boards = visibleBoards;
  if (isAdmin) {
    const { data: allBoards } = await supabase
      .from("community_boards")
      .select(
        "id, name, slug, description, icon, color, display_order, is_visible, allow_posts, allow_comments, allow_images, allow_anonymous, allow_guest_view, admin_only_posting, is_system, is_deleted"
      )
      .eq("is_deleted", false)
      .order("display_order", { ascending: true });
    boards = allBoards ?? visibleBoards;
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <BrowseSidebar />

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 lg:mx-0">
        <h1 className="text-2xl font-semibold tracking-tight">커뮤니티</h1>
        <div className="flex flex-col gap-3">
          {boards.map((board) => (
            <Link key={board.id} href={`/community/${board.slug}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    {board.icon && <span>{board.icon}</span>}
                    {board.name}
                    {!board.is_visible && (
                      <span className="text-xs font-normal text-muted-foreground">(숨김)</span>
                    )}
                  </CardTitle>
                  {board.description && <CardDescription>{board.description}</CardDescription>}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
