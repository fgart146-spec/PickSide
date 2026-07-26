import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toggleSectionVisibility, moveSection } from "@/app/admin/home-sections/actions";
import { HOME_SECTION_LABEL, type HomeSectionKey } from "@/lib/home-sections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminHomeSectionsPage() {
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

  const { data: sections } = await supabase
    .from("home_sections")
    .select("key, is_visible, sort_order")
    .order("sort_order", { ascending: true });

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">홈 화면 섹션 관리</h1>
          <p className="text-sm text-muted-foreground">
            순서를 바꾸거나 숨길 섹션을 선택하세요.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {sections?.map((section, i) => (
            <Card key={section.key}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    {HOME_SECTION_LABEL[section.key as HomeSectionKey]}
                  </CardTitle>
                  <Badge variant={section.is_visible ? "default" : "outline"}>
                    {section.is_visible ? "노출" : "숨김"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <form action={moveSection.bind(null, section.key, "up")}>
                    <Button type="submit" size="sm" variant="ghost" disabled={i === 0}>
                      ↑
                    </Button>
                  </form>
                  <form action={moveSection.bind(null, section.key, "down")}>
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      disabled={i === (sections?.length ?? 1) - 1}
                    >
                      ↓
                    </Button>
                  </form>
                  <form
                    action={toggleSectionVisibility.bind(null, section.key, !section.is_visible)}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      {section.is_visible ? "숨기기" : "노출하기"}
                    </Button>
                  </form>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
