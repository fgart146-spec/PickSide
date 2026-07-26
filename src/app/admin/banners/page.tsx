import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_CONTENT_BUCKET } from "@/lib/supabase/service";
import { toggleBannerActive, deleteBanner } from "@/app/admin/banners/actions";
import { AdminBannerCreateForm } from "@/components/admin-banner-create-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function BannerList({
  banners,
  imageUrlFor,
}: {
  banners: {
    id: string;
    title: string;
    image_path: string | null;
    link_url: string | null;
    is_active: boolean;
    starts_at: string | null;
    ends_at: string | null;
  }[];
  imageUrlFor: (path: string) => string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {banners.map((banner) => (
        <Card key={banner.id} className="overflow-hidden">
          {banner.image_path && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrlFor(banner.image_path)}
              alt={banner.title}
              className="aspect-[3/1] w-full object-cover"
            />
          )}
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">{banner.title}</CardTitle>
              {banner.link_url && <CardDescription>{banner.link_url}</CardDescription>}
              {(banner.starts_at || banner.ends_at) && (
                <CardDescription>
                  {banner.starts_at ? new Date(banner.starts_at).toLocaleString("ko-KR") : "제한 없음"}
                  {" ~ "}
                  {banner.ends_at ? new Date(banner.ends_at).toLocaleString("ko-KR") : "제한 없음"}
                </CardDescription>
              )}
            </div>
            <Badge variant={banner.is_active ? "default" : "outline"}>
              {banner.is_active ? "노출 중" : "숨김"}
            </Badge>
          </CardHeader>
          <CardContent className="flex gap-2">
            <form action={toggleBannerActive.bind(null, banner.id, !banner.is_active)}>
              <Button type="submit" size="sm" variant="outline">
                {banner.is_active ? "숨기기" : "노출하기"}
              </Button>
            </form>
            <form action={deleteBanner.bind(null, banner.id)}>
              <Button type="submit" size="sm" variant="ghost">
                삭제
              </Button>
            </form>
          </CardContent>
        </Card>
      ))}
      {banners.length === 0 && <p className="text-sm text-muted-foreground">없습니다.</p>}
    </div>
  );
}

export default async function AdminBannersPage() {
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

  const { data: banners } = await supabase
    .from("banners")
    .select("id, kind, title, image_path, link_url, is_active, starts_at, ends_at")
    .order("sort_order", { ascending: true });

  const imageUrlFor = (path: string) =>
    supabase.storage.from(SITE_CONTENT_BUCKET).getPublicUrl(path).data.publicUrl;

  const eventBanners = banners?.filter((b) => b.kind === "event") ?? [];
  const homeBanners = banners?.filter((b) => b.kind === "home") ?? [];

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">배너 관리</h1>
          <p className="text-sm text-muted-foreground">
            홈 배너는 홈 화면 최상단에, 이벤트 배너는 공지사항 영역에 표시됩니다.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">홈 배너</h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">새 홈 배너 등록</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminBannerCreateForm kind="home" />
            </CardContent>
          </Card>
          <BannerList banners={homeBanners} imageUrlFor={imageUrlFor} />
        </div>

        <div className="flex flex-col gap-4 border-t pt-8">
          <h2 className="text-lg font-medium">이벤트 배너</h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">새 이벤트 배너 등록</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminBannerCreateForm kind="event" />
            </CardContent>
          </Card>
          <BannerList banners={eventBanners} imageUrlFor={imageUrlFor} />
        </div>
      </div>
    </div>
  );
}
