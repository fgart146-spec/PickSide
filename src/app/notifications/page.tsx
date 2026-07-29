import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { BellIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "알림",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  if (user.is_anonymous) {
    redirect("/signup");
  }

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, message, link, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const unreadIds = (notifications ?? []).filter((n) => !n.is_read).map((n) => n.id);
  if (unreadIds.length > 0) {
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-12">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BellIcon className="size-6 text-primary" />
          알림
        </h1>

        <div className="flex flex-col gap-3">
          {(!notifications || notifications.length === 0) && (
            <p className="text-sm text-muted-foreground">아직 알림이 없어요.</p>
          )}
          {notifications?.map((n) => (
            <Link key={n.id} href={n.link}>
              <Card
                className={`transition-colors hover:bg-accent ${!n.is_read ? "border-primary/40 bg-primary/5" : ""}`}
              >
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-sm font-normal">{n.message}</CardTitle>
                    <CardDescription className="text-xs">
                      {new Date(n.created_at).toLocaleString("ko-KR")}
                    </CardDescription>
                  </div>
                  {!n.is_read && <Badge>새 알림</Badge>}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
