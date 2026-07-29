import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLinkIcon, MessageCircleIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { INQUIRY_TYPES, INQUIRY_TYPE_LABEL, type InquiryType } from "@/lib/inquiries";
import { ContactTypeNav } from "@/components/contact-type-nav";
import { ContactGeneralForm } from "@/components/contact-general-form";
import { ContactBugForm } from "@/components/contact-bug-form";
import { ContactAdForm } from "@/components/contact-ad-form";
import { ContactPartnershipForm } from "@/components/contact-partnership-form";
import { ContactChannelIconView } from "@/components/contact-channel-icon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "문의하기",
  description: "PickSide에 궁금한 점, 버그 제보, 광고·제휴 문의를 남겨주세요.",
  alternates: { canonical: "/contact" },
  openGraph: { url: `${SITE_URL}/contact` },
  robots: { index: true, follow: true },
};

function isInquiryType(value: string | undefined): value is InquiryType {
  return !!value && (INQUIRY_TYPES as readonly string[]).includes(value);
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: typeParam } = await searchParams;
  const activeType = isInquiryType(typeParam) ? typeParam : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let defaultName = "";
  let defaultEmail = "";
  if (user && !user.is_anonymous) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    defaultName = profile?.username ?? "";
    defaultEmail = user.email ?? "";
  }

  const service = createServiceClient();
  const [{ data: settings }, { data: channels }] = await Promise.all([
    service.from("contact_settings").select("*").eq("id", 1).single(),
    service
      .from("contact_channels")
      .select("*")
      .eq("is_visible", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (settings && !settings.page_enabled) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-2 px-4 py-20 text-center">
        <h1 className="text-xl font-semibold tracking-tight">문의하기</h1>
        <p className="text-sm text-muted-foreground">
          현재 문의 페이지 운영이 잠시 중단되었습니다. 다음에 다시 방문해주세요.
        </p>
      </div>
    );
  }

  const enabledTypes: InquiryType[] = INQUIRY_TYPES.filter((t) => {
    if (t === "general") return settings?.general_enabled ?? true;
    if (t === "bug") return settings?.bug_enabled ?? true;
    if (t === "ad") return settings?.ad_enabled ?? true;
    return settings?.partnership_enabled ?? true;
  });

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:py-12">
      <div className="mb-8 flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">문의하기</h1>
        <p className="text-sm text-muted-foreground">
          {settings?.intro_text || "궁금한 점이나 불편한 점이 있으신가요? 아래에서 문의 유형을 선택해주세요."}
        </p>
        {settings?.contact_email && (
          <p className="text-xs text-muted-foreground">
            대표 문의 이메일:{" "}
            <a href={`mailto:${settings.contact_email}`} className="underline underline-offset-2">
              {settings.contact_email}
            </a>
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <ContactTypeNav activeType={activeType} enabledTypes={enabledTypes} />

        <div>
          {activeType === null && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                왼쪽에서 문의 유형을 선택해주세요.
              </CardContent>
            </Card>
          )}
          {activeType && (
            <Card>
              <CardHeader>
                <CardTitle>{INQUIRY_TYPE_LABEL[activeType]}</CardTitle>
              </CardHeader>
              <CardContent>
                {activeType === "general" && (
                  <ContactGeneralForm defaultName={defaultName} defaultEmail={defaultEmail} />
                )}
                {activeType === "bug" && (
                  <ContactBugForm defaultName={defaultName} defaultEmail={defaultEmail} />
                )}
                {activeType === "ad" && (
                  <ContactAdForm defaultName={defaultName} defaultEmail={defaultEmail} />
                )}
                {activeType === "partnership" && (
                  <ContactPartnershipForm defaultName={defaultName} defaultEmail={defaultEmail} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {settings?.business_inquiry_enabled && (
        <div className="mt-6">
          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <MessageCircleIcon className="size-5 shrink-0 text-muted-foreground" />
              <div>
                <CardTitle className="text-sm">비즈니스 문의</CardTitle>
                <CardDescription className="text-xs">
                  {settings.business_inquiry_description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={settings.business_inquiry_url}
                    target={settings.business_inquiry_open_new_tab ? "_blank" : undefined}
                    rel={settings.business_inquiry_open_new_tab ? "noopener noreferrer" : undefined}
                  >
                    {settings.business_inquiry_label}
                    <ExternalLinkIcon className="size-3.5" />
                  </Link>
                }
              />
            </CardContent>
          </Card>
        </div>
      )}

      {channels && channels.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {channels.map((channel) => (
            <Card key={channel.id}>
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <ContactChannelIconView
                  icon={channel.icon}
                  className="size-5 shrink-0 text-muted-foreground"
                />
                <div>
                  <CardTitle className="text-sm">{channel.name}</CardTitle>
                  {channel.description && (
                    <CardDescription className="text-xs">{channel.description}</CardDescription>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link
                      href={channel.url}
                      target={channel.open_new_tab ? "_blank" : undefined}
                      rel={channel.open_new_tab ? "noopener noreferrer" : undefined}
                    >
                      {channel.button_label}
                      <ExternalLinkIcon className="size-3.5" />
                    </Link>
                  }
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
