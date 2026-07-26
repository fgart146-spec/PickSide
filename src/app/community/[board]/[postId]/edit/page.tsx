import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCommunityBoard } from "@/lib/community-boards";
import { CommunityEditForm } from "@/components/community-edit-form";

export default async function EditCommunityPostPage({
  params,
}: {
  params: Promise<{ board: string; postId: string }>;
}) {
  const { board, postId } = await params;
  if (!isCommunityBoard(board)) {
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
    .eq("board", board)
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
      redirect(`/community/${board}/${postId}`);
    }
  }

  return (
    <CommunityEditForm
      board={board}
      postId={postId}
      initialTitle={post.title}
      initialBody={post.body}
    />
  );
}
