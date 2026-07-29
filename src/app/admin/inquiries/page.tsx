import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/pagination";
import { escapeLike, quoteOrValue } from "@/lib/search";
import { INQUIRY_TYPES, INQUIRY_TYPE_LABEL, INQUIRY_STATUS_LABEL, type InquiryType } from "@/lib/inquiries";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function isInquiryType(value: string | undefined): value is InquiryType {
  return !!value && (INQUIRY_TYPES as readonly string[]).includes(value);
}

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
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

  const { q, type: typeParam, page: pageParam } = await searchParams;
  const query = q?.trim() ?? "";
  const activeType = isInquiryType(typeParam) ? typeParam : null;
  const page = parsePage(pageParam);
  const from = (page - 1) * PAGE_SIZE;

  let inquiriesQuery = supabase
    .from("inquiries")
    .select("id, type, status, name, email, subject, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (activeType) inquiriesQuery = inquiriesQuery.eq("type", activeType);
  if (query) {
    const pattern = quoteOrValue(`%${escapeLike(query)}%`);
    inquiriesQuery = inquiriesQuery.or(`name.ilike.${pattern},email.ilike.${pattern}`);
  }

  const { data } = await inquiriesQuery.range(from, from + PAGE_SIZE);
  const rows = data ?? [];
  const hasNext = rows.length > PAGE_SIZE;
  const inquiries = rows.slice(0, PAGE_SIZE);

  const makeHref = (p: number) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (activeType) sp.set("type", activeType);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/admin/inquiries?${qs}` : "/admin/inquiries";
  };

  const typeHref = (type: InquiryType | null) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (type) sp.set("type", type);
    const qs = sp.toString();
    return qs ? `/admin/inquiries?${qs}` : "/admin/inquiries";
  };

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">문의 내역</h1>
          <p className="text-sm text-muted-foreground">
            접수된 문의를 최신순으로 표시합니다. 이름/이메일로 검색할 수 있어요.
          </p>
        </div>

        <form className="flex gap-2">
          {activeType && <input type="hidden" name="type" value={activeType} />}
          <Input name="q" placeholder="이름 또는 이메일로 검색" defaultValue={query} />
          <Button type="submit" variant="outline">
            검색
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={activeType === null ? "default" : "outline"}
            nativeButton={false}
            render={<Link href={typeHref(null)}>전체</Link>}
          />
          {INQUIRY_TYPES.map((type) => (
            <Button
              key={type}
              size="sm"
              variant={activeType === type ? "default" : "outline"}
              nativeButton={false}
              render={<Link href={typeHref(type)}>{INQUIRY_TYPE_LABEL[type]}</Link>}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {inquiries.map((inquiry) => (
            <Link key={inquiry.id} href={`/admin/inquiries/${inquiry.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <div className="mb-1 flex items-center gap-1.5">
                      <Badge variant="outline">{INQUIRY_TYPE_LABEL[inquiry.type as InquiryType]}</Badge>
                      <Badge variant="secondary">{INQUIRY_STATUS_LABEL[inquiry.status] ?? inquiry.status}</Badge>
                    </div>
                    <CardTitle className="text-base">
                      {inquiry.subject || inquiry.name}
                    </CardTitle>
                    <CardDescription>
                      {inquiry.name} · {inquiry.email} ·{" "}
                      {new Date(inquiry.created_at).toLocaleString("ko-KR")}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
          {inquiries.length === 0 && (
            <p className="text-sm text-muted-foreground">문의가 없습니다.</p>
          )}
        </div>

        <Pagination page={page} hasNext={hasNext} makeHref={makeHref} />
      </div>
    </div>
  );
}
