import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function escapeLike(value: string) {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

function statusBadge(user: { banned_at: string | null; suspended_until: string | null }) {
  if (user.banned_at) {
    return <Badge variant="destructive">영구 정지</Badge>;
  }
  if (user.suspended_until && new Date(user.suspended_until) > new Date()) {
    return <Badge variant="secondary">일시 정지</Badge>;
  }
  return <Badge variant="outline">정상</Badge>;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
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

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  let usersQuery = supabase
    .from("profiles")
    .select("id, username, is_admin, is_anonymous, suspended_until, banned_at, created_at")
    .eq("is_anonymous", false)
    .order("created_at", { ascending: false })
    .limit(200);

  if (query) {
    usersQuery = usersQuery.ilike("username", `%${escapeLike(query)}%`);
  }

  const { data: users } = await usersQuery;

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">사용자 관리</h1>
          <p className="text-sm text-muted-foreground">
            최근 가입한 200명을 표시합니다. 닉네임으로 검색할 수 있어요.
          </p>
        </div>

        <form className="flex gap-2">
          <Input name="q" placeholder="닉네임으로 검색" defaultValue={query} />
          <Button type="submit" variant="outline">
            검색
          </Button>
        </form>

        <div className="flex flex-col gap-3">
          {users?.map((u) => (
            <Link key={u.id} href={`/admin/users/${u.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">
                      {u.username}
                      {u.is_admin && (
                        <Badge variant="outline" className="ml-2">
                          관리자
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      가입일 {new Date(u.created_at).toLocaleDateString("ko-KR")}
                    </CardDescription>
                  </div>
                  {statusBadge(u)}
                </CardHeader>
              </Card>
            </Link>
          ))}
          {(!users || users.length === 0) && (
            <p className="text-sm text-muted-foreground">사용자가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
