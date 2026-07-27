import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_CONTENT_BUCKET } from "@/lib/supabase/service";
import { toggleBannerActive, deleteBanner } from "@/app/admin/banners/actions";
import { AdminBannerCreateForm } from "@/components/admin-banner-create-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function BannerList({
  banners,
  imageUrlFor,
  page,
  hasNext,
  makeHref,
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
  page: number;
  hasNext: boolean;
  makeHref: (page: number) => string;
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
      <Pagination page={page} hasNext={hasNext} makeHref={makeHref} />
    </div>
  );
}

export default async function AdminBannersPage({
  searchParams,
}: {
  searchParams: Promise<{ homePage?: string; eventPage?: string }>;
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

  const { data: banners } = await supabase
    .from("banners")
    .select("id, kind, title, image_path, link_url, is_active, starts_at, ends_at")
    .order("sort_order", { ascending: true });

  const imageUrlFor = (path: string) =>
    supabase.storage.from(SITE_CONTENT_BUCKET).getPublicUrl(path).data.publicUrl;

  const allEvent = banners?.filter((b) => b.kind === "event") ?? [];
  const allHome = banners?.filter((b) => b.kind === "home") ?? [];

  const { homePage: homePageParam, eventPage: eventPageParam } = await searchParams;
  const homePage = parsePage(homePageParam);
  const eventPage = parsePage(eventPageParam);
  const homeStart = (homePage - 1) * PAGE_SIZE;
  const eventStart = (eventPage - 1) * PAGE_SIZE;
  const homeBanners = allHome.slice(homeStart, homeStart + PAGE_SIZE);
  const eventBanners = allEvent.slice(eventStart, eventStart + PAGE_SIZE);
  const homeHasNext = allHome.length > homeStart + PAGE_SIZE;
  const eventHasNext = allEvent.length > eventStart + PAGE_SIZE;

  const bannerHref = (params: { homePage?: number; eventPage?: number }) => {
    const sp = new URLSearchParams();
    const h = params.homePage ?? homePage;
    const e = params.eventPage ?? eventPage;
    if (h > 1) sp.set("homePage", String(h));
    if (e > 1) sp.set("eventPage", String(e));
    const qs = sp.toString();
    return qs ? `/admin/banners?${qs}` : "/admin/banners";
  };

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
          <BannerList
            banners={homeBanners}
            imageUrlFor={imageUrlFor}
            page={homePage}
            hasNext={homeHasNext}
            makeHref={(p) => bannerHref({ homePage: p })}
          />
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
          <BannerList
            banners={eventBanners}
            imageUrlFor={imageUrlFor}
            page={eventPage}
            hasNext={eventHasNext}
            makeHref={(p) => bannerHref({ eventPage: p })}
          />
        </div>
      </div>
    </div>
  );
}
