import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { restoreCategory } from "@/app/admin/categories/actions";
import { AdminCategoryCreateForm } from "@/components/admin-category-create-form";
import { CategoryReorderList } from "@/components/category-reorder-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryRow } from "@/lib/categories";

export default async function AdminCategoriesPage({
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
    "id, name, slug, description, icon, color, display_order, is_visible, show_on_home, is_system, is_deleted";

  let activeQuery = supabase.from("categories").select(SELECT).eq("is_deleted", false);
  if (query) activeQuery = activeQuery.ilike("name", `%${query}%`);

  const [{ data: active }, { data: deleted }, { data: allPollRows }, { data: publishedPollRows }] =
    await Promise.all([
      activeQuery.order("display_order", { ascending: true }),
      supabase
        .from("categories")
        .select(SELECT)
        .eq("is_deleted", true)
        .order("updated_at", { ascending: false }),
      // All non-deleted polls (any status) — what actually gets moved when a
      // category is deleted, so the delete-confirmation warning must include
      // pending/rejected polls too, not just published ones.
      supabase.from("polls").select("category_id").is("deleted_at", null),
      // Published-only — what a visitor actually sees for that category, so
      // this is the number that must match the public site (home/category
      // pages), not the admin-only total.
      supabase
        .from("polls")
        .select("category_id")
        .is("deleted_at", null)
        .eq("status", "published"),
    ]);

  const pollCounts: Record<string, number> = {};
  for (const row of allPollRows ?? []) {
    pollCounts[row.category_id] = (pollCounts[row.category_id] ?? 0) + 1;
  }
  const publishedPollCounts: Record<string, number> = {};
  for (const row of publishedPollRows ?? []) {
    publishedPollCounts[row.category_id] = (publishedPollCounts[row.category_id] ?? 0) + 1;
  }

  const activeCategories = (active ?? []) as CategoryRow[];
  const deletedCategories = (deleted ?? []) as CategoryRow[];

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">투표 카테고리 관리</h1>
          <p className="text-sm text-muted-foreground">
            추가·수정한 카테고리는 재배포 없이 투표 작성 페이지와 홈 화면에 바로 반영됩니다.
            카드를 드래그해서 순서를 바꿀 수 있어요.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">새 카테고리 추가</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminCategoryCreateForm />
          </CardContent>
        </Card>

        <form className="flex gap-2">
          <Input name="q" placeholder="카테고리 이름으로 검색" defaultValue={query} />
          <Button type="submit" variant="outline">
            검색
          </Button>
        </form>

        <CategoryReorderList
          categories={activeCategories}
          pollCounts={pollCounts}
          publishedPollCounts={publishedPollCounts}
        />
        {activeCategories.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {query ? "검색 결과가 없습니다." : "카테고리가 없습니다."}
          </p>
        )}

        {deletedCategories.length > 0 && (
          <div className="flex flex-col gap-3 border-t pt-6">
            <h2 className="text-lg font-medium">삭제된 카테고리 ({deletedCategories.length})</h2>
            {deletedCategories.map((category) => (
              <Card key={category.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {category.icon && <span className="mr-1.5">{category.icon}</span>}
                    {category.name}
                  </CardTitle>
                  <CardDescription>
                    /category/{category.slug} · 투표 {pollCounts[category.id] ?? 0}개
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={restoreCategory.bind(null, category.id)}>
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
