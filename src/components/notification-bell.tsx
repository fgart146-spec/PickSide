import Link from "next/link";
import { BellIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

// Async Server Component — fetches its own unread count so NavBar doesn't
// need to thread it through, matching the CategoryNav/CommunityNav pattern.
export async function NotificationBell({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  const unread = count ?? 0;

  return (
    <Button
      variant="ghost"
      size="sm"
      nativeButton={false}
      className="relative"
      render={
        <Link href="/notifications" aria-label="알림">
          <BellIcon />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      }
    />
  );
}
