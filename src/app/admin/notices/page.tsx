import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toggleNoticeActive, deleteNotice } from "@/app/admin/notices/actions";
import { AdminNoticeCreateForm } from "@/components/admin-notice-create-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
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

  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const from = (page - 1) * PAGE_SIZE;

  const { data } = await supabase
    .from("notices")
    .select("id, title, body, is_active, created_at")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE);

  const rows = data ?? [];
  const hasNext = rows.length > PAGE_SIZE;
  const notices = rows.slice(0, PAGE_SIZE);

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">공지사항 관리</h1>
          <p className="text-sm text-muted-foreground">
            활성화된 공지는 홈 화면 상단에 표시됩니다.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">새 공지 등록</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminNoticeCreateForm />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          {notices?.map((notice) => (
            <Card key={notice.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{notice.title}</CardTitle>
                  <CardDescription className="whitespace-pre-wrap">{notice.body}</CardDescription>
                </div>
                <Badge variant={notice.is_active ? "default" : "outline"}>
                  {notice.is_active ? "노출 중" : "숨김"}
                </Badge>
              </CardHeader>
              <CardContent className="flex gap-2">
                <form action={toggleNoticeActive.bind(null, notice.id, !notice.is_active)}>
                  <Button type="submit" size="sm" variant="outline">
                    {notice.is_active ? "숨기기" : "노출하기"}
                  </Button>
                </form>
                <form action={deleteNotice.bind(null, notice.id)}>
                  <Button type="submit" size="sm" variant="ghost">
                    삭제
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
          {notices.length === 0 && (
            <p className="text-sm text-muted-foreground">등록된 공지가 없습니다.</p>
          )}
          <Pagination
            page={page}
            hasNext={hasNext}
            makeHref={(p) => (p > 1 ? `/admin/notices?page=${p}` : "/admin/notices")}
          />
        </div>
      </div>
    </div>
  );
}
