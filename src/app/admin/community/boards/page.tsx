import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { restoreBoard } from "@/app/admin/community/boards/actions";
import { AdminBoardCreateForm } from "@/components/admin-board-create-form";
import { BoardReorderList } from "@/components/board-reorder-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CommunityBoardRow } from "@/lib/community-boards";

export default async function AdminCommunityBoardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
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

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const SELECT =
    "id, name, slug, description, icon, color, display_order, is_visible, allow_posts, allow_comments, allow_images, allow_anonymous, allow_guest_view, admin_only_posting, is_system, is_deleted";

  let activeQuery = supabase.from("community_boards").select(SELECT).eq("is_deleted", false);
  if (query) activeQuery = activeQuery.ilike("name", `%${query}%`);

  const [{ data: active }, { data: deleted }, { data: boardIds }] = await Promise.all([
    activeQuery.order("display_order", { ascending: true }),
    supabase
      .from("community_boards")
      .select(SELECT)
      .eq("is_deleted", true)
      .order("updated_at", { ascending: false }),
    supabase.from("community_posts").select("board_id").is("deleted_at", null),
  ]);

  const postCounts: Record<string, number> = {};
  for (const row of boardIds ?? []) {
    postCounts[row.board_id] = (postCounts[row.board_id] ?? 0) + 1;
  }

  const activeBoards = (active ?? []) as CommunityBoardRow[];
  const deletedBoards = (deleted ?? []) as CommunityBoardRow[];

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">게시판 관리</h1>
          <p className="text-sm text-muted-foreground">
            추가·수정한 게시판은 재배포 없이 커뮤니티 화면에 바로 반영됩니다. 카드를 드래그해서
            순서를 바꿀 수 있어요.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">새 게시판 추가</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminBoardCreateForm />
          </CardContent>
        </Card>

        <form className="flex gap-2">
          <Input name="q" placeholder="게시판 이름으로 검색" defaultValue={query} />
          <Button type="submit" variant="outline">
            검색
          </Button>
        </form>

        <BoardReorderList boards={activeBoards} postCounts={postCounts} />
        {activeBoards.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {query ? "검색 결과가 없습니다." : "게시판이 없습니다."}
          </p>
        )}

        {deletedBoards.length > 0 && (
          <div className="flex flex-col gap-3 border-t pt-6">
            <h2 className="text-lg font-medium">삭제된 게시판 ({deletedBoards.length})</h2>
            {deletedBoards.map((board) => (
              <Card key={board.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {board.icon && <span className="mr-1.5">{board.icon}</span>}
                    {board.name}
                  </CardTitle>
                  <CardDescription>
                    /community/{board.slug} · 게시글 {postCounts[board.id] ?? 0}개
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={restoreBoard.bind(null, board.id)}>
                    <Button type="submit" size="sm" variant="outline">
                      복원
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
