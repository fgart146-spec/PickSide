import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function getPolicyDocument(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("policy_documents")
    .select("title, body, updated_at")
    .eq("slug", slug)
    .single();
  return data;
}

export async function PolicyPage({ slug }: { slug: string }) {
  const document = await getPolicyDocument(slug);
  if (!document) {
    notFound();
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{document.title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              마지막 업데이트: {new Date(document.updated_at).toLocaleDateString("ko-KR")}
            </p>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{document.body}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
