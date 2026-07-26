import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const LINKS = [
  { href: "/admin/notices", label: "공지사항", description: "공지 등록/노출 관리" },
  { href: "/admin/popups", label: "팝업", description: "홈 화면 팝업 등록/노출 관리" },
  { href: "/admin/banners", label: "배너", description: "홈 배너 / 이벤트 배너 관리" },
  { href: "/admin/ad-slots", label: "광고 영역", description: "홈 화면 광고 위치 관리" },
  {
    href: "/admin/home-sections",
    label: "홈 섹션 순서",
    description: "홈 화면 섹션 노출 여부/순서 관리",
  },
];

export default async function AdminHomePage() {
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

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">홈 화면 관리</h1>
        <div className="flex flex-col gap-3">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle className="text-base">{link.label}</CardTitle>
                  <CardDescription>{link.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
