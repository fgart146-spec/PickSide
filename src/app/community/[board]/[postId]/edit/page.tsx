import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBoardBySlug } from "@/lib/community-boards-data";
import { CommunityEditForm } from "@/components/community-edit-form";

export default async function EditCommunityPostPage({
  params,
}: {
  params: Promise<{ board: string; postId: string }>;
}) {
  const { board: boardSlug, postId } = await params;
  const board = await getBoardBySlug(boardSlug);
  if (!board) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: post } = await supabase
    .from("community_posts")
    .select("id, title, body, author_id")
    .eq("id", postId)
    .eq("board_id", board.id)
    .single();

  if (!post) {
    notFound();
  }

  if (post.author_id !== user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      redirect(`/community/${boardSlug}/${postId}`);
    }
  }

  return (
    <CommunityEditForm
      board={boardSlug}
      postId={postId}
      initialTitle={post.title}
      initialBody={post.body}
    />
  );
}
