import Link from "next/link";
import Image from "next/image";
import { UserIcon, PlusIcon, LogOutIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { AdminNavMenu } from "@/components/admin-nav-menu";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";

export async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // Guest voters get a real (anonymous) session too — treat them like
  // signed-out visitors in the nav so "투표 만들기"/"로그아웃" stay hidden.
  const user = authUser && !authUser.is_anonymous ? authUser : null;

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.is_admin ?? false;
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-y-2 px-4 py-2.5 lg:max-w-6xl">
        <Link href="/" className="flex items-center">
          <Image src="/logo.webp" alt="PickSide" width={720} height={360} priority className="h-14 w-auto" />
        </Link>
        <nav className="flex flex-wrap items-center gap-1.5">
          {user ? (
            <>
              {isAdmin && <AdminNavMenu />}
              <NotificationBell userId={user.id} />
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={
                  <Link href="/me">
                    <UserIcon />
                    마이페이지
                  </Link>
                }
              />
              <Button
                size="sm"
                nativeButton={false}
                render={
                  <Link href="/polls/new">
                    <PlusIcon />
                    투표 만들기
                  </Link>
                }
              />
              <form action={signOut}>
                <Button type="submit" size="sm" variant="outline">
                  <LogOutIcon />
                  로그아웃
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/login">로그인</Link>}
              />
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/signup">회원가입</Link>}
              />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
