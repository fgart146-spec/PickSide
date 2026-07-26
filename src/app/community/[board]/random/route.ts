import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCommunityBoard } from "@/lib/community-boards";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ board: string }> }
) {
  const { board } = await params;
  if (!isCommunityBoard(board)) {
    return NextResponse.redirect(new URL("/community", request.url));
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("community_posts")
    .select("id")
    .eq("board", board)
    .is("deleted_at", null);

  const posts = data ?? [];
  if (posts.length === 0) {
    return NextResponse.redirect(new URL(`/community/${board}`, request.url));
  }

  const pick = posts[Math.floor(Math.random() * posts.length)];
  return NextResponse.redirect(new URL(`/community/${board}/${pick.id}`, request.url));
}
