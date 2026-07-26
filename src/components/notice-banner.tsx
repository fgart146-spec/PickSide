import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SITE_CONTENT_BUCKET } from "@/lib/supabase/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export async function NoticeBanner() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [{ data: notices }, { data: eventBanners }] = await Promise.all([
    supabase
      .from("notices")
      .select("id, title, body, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("banners")
      .select("id, title, image_path, link_url")
      .eq("kind", "event")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("sort_order", { ascending: true })
      .limit(5),
  ]);

  if ((!notices || notices.length === 0) && (!eventBanners || eventBanners.length === 0)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {notices?.map((notice) => (
        <Card key={notice.id} className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="mb-1">
              <Badge>공지</Badge>
            </div>
            <CardTitle className="text-base">{notice.title}</CardTitle>
            <CardDescription className="whitespace-pre-wrap">{notice.body}</CardDescription>
          </CardHeader>
        </Card>
      ))}

      {eventBanners?.map((banner) => {
        const imageUrl = banner.image_path
          ? supabase.storage.from(SITE_CONTENT_BUCKET).getPublicUrl(banner.image_path).data
              .publicUrl
          : null;
        const content = (
          <Card className="overflow-hidden transition-colors hover:bg-accent">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={banner.title}
                className="aspect-[3/1] w-full object-cover"
              />
            ) : (
              <CardHeader>
                <div className="mb-1">
                  <Badge variant="secondary">이벤트</Badge>
                </div>
                <CardTitle className="text-base">{banner.title}</CardTitle>
              </CardHeader>
            )}
          </Card>
        );
        return banner.link_url ? (
          <Link key={banner.id} href={banner.link_url}>
            {content}
          </Link>
        ) : (
          <div key={banner.id}>{content}</div>
        );
      })}
    </div>
  );
}
