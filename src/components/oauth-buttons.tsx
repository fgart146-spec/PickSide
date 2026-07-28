"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function OAuthButtons() {
  const [pending, setPending] = useState(false);

  // Kakao login is temporarily disabled: its "account_email" consent item
  // requires business-app verification, so requesting it on this
  // personal-dev app fails with KOE205. Re-enable once that's resolved.
  async function signInWithGoogle() {
    setPending(true);
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
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={signInWithGoogle}
      >
        {pending ? "이동 중..." : "Google로 계속하기"}
      </Button>
      <Button type="button" variant="outline" className="w-full" disabled>
        Kakao로 계속하기 (점검 중)
      </Button>
    </div>
  );
}
