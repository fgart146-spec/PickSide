import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBoardBySlug } from "@/lib/community-boards-data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ board: string }> }
) {
  const { board: boardSlug } = await params;
  const board = await getBoardBySlug(boardSlug);
  if (!board) {
    return NextResponse.redirect(new URL("/community", request.url));
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("community_posts")
    .select("id")
    .eq("board_id", board.id)
    .is("deleted_at", null);

  const posts = data ?? [];
  if (posts.length === 0) {
    return NextResponse.redirect(new URL(`/community/${boardSlug}`, request.url));
  }

  const pick = posts[Math.floor(Math.random() * posts.length)];
  return NextResponse.redirect(new URL(`/community/${boardSlug}/${pick.id}`, request.url));
}
