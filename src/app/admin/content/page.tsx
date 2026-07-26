import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const LINKS = [
  { href: "/admin/polls", label: "전체 투표", description: "승인/반려/수정/삭제" },
  { href: "/admin/comments", label: "전체 투표 댓글", description: "댓글 조회 및 삭제" },
  {
    href: "/admin/community/posts",
    label: "커뮤니티 게시글",
    description: "전체 게시글 조회, 수정, 삭제",
  },
  {
    href: "/admin/community/comments",
    label: "커뮤니티 댓글",
    description: "전체 댓글 조회 및 삭제",
  },
];

export default async function AdminContentPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight">콘텐츠 관리</h1>
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
