import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { AdminContactSettingsForm } from "@/components/admin-contact-settings-form";
import { AdminContactChannelsSection } from "@/components/admin-contact-channels-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminContactSettingsPage() {
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

  const service = createServiceClient();
  const [{ data: settings }, { data: channels }] = await Promise.all([
    supabase.from("contact_settings").select("*").eq("id", 1).single(),
    service.from("contact_channels").select("*").order("sort_order", { ascending: true }),
  ]);

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">문의 설정</h1>
          <p className="text-sm text-muted-foreground">
            /contact 페이지의 노출 여부, 안내 문구, 문의 채널을 관리합니다.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">기본 설정 · 비즈니스 문의</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminContactSettingsForm
              pageEnabled={settings?.page_enabled ?? true}
              generalEnabled={settings?.general_enabled ?? true}
              bugEnabled={settings?.bug_enabled ?? true}
              adEnabled={settings?.ad_enabled ?? true}
              partnershipEnabled={settings?.partnership_enabled ?? true}
              contactEmail={settings?.contact_email ?? ""}
              introText={settings?.intro_text ?? ""}
              businessEnabled={settings?.business_inquiry_enabled ?? true}
              businessLabel={settings?.business_inquiry_label ?? ""}
              businessDescription={settings?.business_inquiry_description ?? ""}
              businessUrl={settings?.business_inquiry_url ?? ""}
              businessOpenNewTab={settings?.business_inquiry_open_new_tab ?? true}
            />
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">추가 문의 채널</h2>
          <AdminContactChannelsSection channels={channels ?? []} />
        </div>
      </div>
    </div>
  );
}
