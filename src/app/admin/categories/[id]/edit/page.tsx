import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminCategoryEditForm } from "@/components/admin-category-edit-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminCategoryEditPage({
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

  const { data: category } = await supabase
    .from("categories")
    .select(
      "id, name, slug, description, icon, color, display_order, is_visible, show_on_home, is_system, is_deleted"
    )
    .eq("id", id)
    .single();

  if (!category) {
    notFound();
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <Link
          href="/admin/categories"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← 카테고리 목록
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">카테고리 수정</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminCategoryEditForm category={category} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
