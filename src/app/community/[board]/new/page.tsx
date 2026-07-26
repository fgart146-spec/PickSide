import { notFound } from "next/navigation";
import { isCommunityBoard } from "@/lib/community-boards";
import { CommunityPostForm } from "@/components/community-post-form";

export default async function NewCommunityPostPage({
  params,
}: {
  params: Promise<{ board: string }>;
}) {
  const { board } = await params;
  if (!isCommunityBoard(board)) {
    notFound();
  }

  return <CommunityPostForm board={board} />;
}
