import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_CONTENT_BUCKET } from "@/lib/supabase/service";
import { clearAdSlot } from "@/app/admin/ad-slots/actions";
import { AdminAdSlotForm } from "@/components/admin-ad-slot-form";
import { AD_SLOTS, AD_SLOT_LABEL, AD_SLOT_ASPECT } from "@/lib/ad-slots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminAdSlotsPage() {
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

  const { data: slots } = await supabase
    .from("ad_slots")
    .select("slot_key, image_path, link_url, is_active");

  const slotByKey = new Map((slots ?? []).map((s) => [s.slot_key, s]));

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">광고 영역 관리</h1>
          <p className="text-sm text-muted-foreground">
            이미지를 등록하고 활성화하면 홈 화면의 해당 위치에 노출됩니다.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {AD_SLOTS.map((slotKey) => {
            const slot = slotByKey.get(slotKey);
            return (
              <Card key={slotKey} className="overflow-hidden">
                {slot?.image_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      supabase.storage.from(SITE_CONTENT_BUCKET).getPublicUrl(slot.image_path)
                        .data.publicUrl
                    }
                    alt={AD_SLOT_LABEL[slotKey]}
                    className={`w-full object-cover ${AD_SLOT_ASPECT[slotKey]}`}
                  />
                )}
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{AD_SLOT_LABEL[slotKey]}</CardTitle>
                  <Badge variant={slot?.is_active ? "default" : "outline"}>
                    {slot?.is_active ? "노출 중" : "숨김"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <AdminAdSlotForm
                    slotKey={slotKey}
                    linkUrl={slot?.link_url ?? null}
                    isActive={slot?.is_active ?? false}
                  />
                  <form action={clearAdSlot.bind(null, slotKey)}>
                    <Button type="submit" size="sm" variant="ghost">
                      초기화
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
