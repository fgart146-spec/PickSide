import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminContactSettingsForm } from "@/components/admin-contact-settings-form";
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

  const { data: settings } = await supabase
    .from("contact_settings")
    .select(
      "business_inquiry_enabled, business_inquiry_label, business_inquiry_description, business_inquiry_url, business_inquiry_open_new_tab"
    )
    .eq("id", 1)
    .single();

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">문의 설정</h1>
          <p className="text-sm text-muted-foreground">
            /contact 페이지의 비즈니스 문의 채널을 관리합니다.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">비즈니스 문의 (카카오톡 등)</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminContactSettingsForm
              enabled={settings?.business_inquiry_enabled ?? true}
              label={settings?.business_inquiry_label ?? ""}
              description={settings?.business_inquiry_description ?? ""}
              url={settings?.business_inquiry_url ?? ""}
              openNewTab={settings?.business_inquiry_open_new_tab ?? true}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
