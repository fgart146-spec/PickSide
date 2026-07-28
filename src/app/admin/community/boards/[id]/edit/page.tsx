import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminBoardEditForm } from "@/components/admin-board-edit-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminBoardEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/");
  }

  const { data: board } = await supabase
    .from("community_boards")
    .select(
      "id, name, slug, description, icon, color, display_order, is_visible, allow_posts, allow_comments, allow_images, allow_anonymous, allow_guest_view, admin_only_posting, is_system, is_deleted"
    )
    .eq("id", id)
    .single();

  if (!board) {
    notFound();
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <Link
          href="/admin/community/boards"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← 게시판 목록
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">게시판 수정</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminBoardEditForm board={board} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
