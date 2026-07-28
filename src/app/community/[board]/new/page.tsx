import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBoardBySlug } from "@/lib/community-boards-data";
import { CommunityPostForm } from "@/components/community-post-form";

export default async function NewCommunityPostPage({
  params,
}: {
  params: Promise<{ board: string }>;
}) {
  const { board: boardSlug } = await params;
  const board = await getBoardBySlug(boardSlug);
  if (!board) {
    notFound();
  }

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

  const canWrite = board.allow_posts && (!board.admin_only_posting || isAdmin);
  if (!canWrite) {
    redirect(`/community/${boardSlug}`);
  }

  return (
    <CommunityPostForm
      boardSlug={board.slug}
      boardName={board.name}
      allowImages={board.allow_images}
    />
  );
}
