import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_CONTENT_BUCKET } from "@/lib/supabase/service";
import { togglePopupActive, deletePopup } from "@/app/admin/popups/actions";
import { AdminPopupCreateForm } from "@/components/admin-popup-create-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminPopupsPage({
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
    .from("popups")
    .select("id, title, body, image_path, link_url, is_active, starts_at, ends_at")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE);

  const rows = data ?? [];
  const hasNext = rows.length > PAGE_SIZE;
  const popups = rows.slice(0, PAGE_SIZE);

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">팝업 관리</h1>
          <p className="text-sm text-muted-foreground">
            활성화되고 기간 내인 팝업이 홈 화면 진입 시 표시됩니다.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">새 팝업 등록</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminPopupCreateForm />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          {popups?.map((popup) => (
            <Card key={popup.id} className="overflow-hidden">
              {popup.image_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    supabase.storage.from(SITE_CONTENT_BUCKET).getPublicUrl(popup.image_path).data
                      .publicUrl
                  }
                  alt={popup.title}
                  className="max-h-48 w-full bg-muted object-contain"
                />
              )}
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{popup.title}</CardTitle>
                  {popup.body && (
                    <CardDescription className="whitespace-pre-wrap">
                      {popup.body}
                    </CardDescription>
                  )}
                  {(popup.starts_at || popup.ends_at) && (
                    <CardDescription>
                      {popup.starts_at
                        ? new Date(popup.starts_at).toLocaleString("ko-KR")
                        : "제한 없음"}
                      {" ~ "}
                      {popup.ends_at
                        ? new Date(popup.ends_at).toLocaleString("ko-KR")
                        : "제한 없음"}
                    </CardDescription>
                  )}
                </div>
                <Badge variant={popup.is_active ? "default" : "outline"}>
                  {popup.is_active ? "노출 중" : "숨김"}
                </Badge>
              </CardHeader>
              <CardContent className="flex gap-2">
                <form action={togglePopupActive.bind(null, popup.id, !popup.is_active)}>
                  <Button type="submit" size="sm" variant="outline">
                    {popup.is_active ? "숨기기" : "노출하기"}
                  </Button>
                </form>
                <form action={deletePopup.bind(null, popup.id)}>
                  <Button type="submit" size="sm" variant="ghost">
                    삭제
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
          {popups.length === 0 && (
            <p className="text-sm text-muted-foreground">등록된 팝업이 없습니다.</p>
          )}
          <Pagination
            page={page}
            hasNext={hasNext}
            makeHref={(p) => (p > 1 ? `/admin/popups?page=${p}` : "/admin/popups")}
          />
        </div>
      </div>
    </div>
  );
}
