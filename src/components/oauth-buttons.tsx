"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function OAuthButtons() {
  const [pending, setPending] = useState<"google" | "kakao" | null>(null);

  async function signInWith(provider: "google" | "kakao") {
    setPending(provider);
    const supabase = createClient();

    // See the matching comment in src/app/auth/actions.ts: switching away
    // from a guest session without cleaning up its votes leaves them
    // orphaned in the DB.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.is_anonymous) {
      await supabase.from("votes").delete().eq("voter_id", user.id);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Kakao's "account_email" consent item requires business-app
        // verification; requesting it on a personal-dev app fails with
        // KOE205. Nickname alone is enough to create a profile.
        ...(provider === "kakao" ? { scopes: "profile_nickname" } : {}),
      },
    });
    if (error) {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending !== null}
        onClick={() => signInWith("google")}
      >
        {pending === "google" ? "이동 중..." : "Google로 계속하기"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending !== null}
        onClick={() => signInWith("kakao")}
      >
        {pending === "kakao" ? "이동 중..." : "Kakao로 계속하기"}
      </Button>
    </div>
  );
}
