import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminPoliciesPage() {
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

  const { data: documents } = await supabase
    .from("policy_documents")
    .select("slug, title, updated_at")
    .order("slug");

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">약관/정책 관리</h1>
          <p className="text-sm text-muted-foreground">
            이용약관, 개인정보처리방침 내용을 수정하면 재배포 없이 바로 반영됩니다.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {documents?.map((doc) => (
            <Card key={doc.slug}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{doc.title}</CardTitle>
                  <CardDescription>
                    /{doc.slug} · 마지막 수정{" "}
                    {new Date(doc.updated_at).toLocaleString("ko-KR")}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/admin/policies/${doc.slug}/edit`}>수정</Link>}
                />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
