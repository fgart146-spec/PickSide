import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminPolicyEditForm } from "@/components/admin-policy-edit-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminPolicyEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  const { data: document } = await supabase
    .from("policy_documents")
    .select("slug, title, body")
    .eq("slug", slug)
    .single();

  if (!document) {
    notFound();
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <Link
          href="/admin/policies"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← 약관/정책 목록
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{document.title} 수정</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminPolicyEditForm slug={document.slug} title={document.title} body={document.body} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
