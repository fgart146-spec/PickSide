"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { suspensionMessage } from "@/lib/moderation";

export type AuthState = { error: string | null };

// Switching from a guest (anonymous) session to a real account abandons the
// anonymous session's cookie without signing it out, leaving its votes
// orphaned in the DB — every subsequent guest-vote cycle would then create
// yet another anonymous identity. Clean up the anonymous user's votes while
// its session is still the active one, right before replacing it.
async function cleanupAnonymousVotes(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.is_anonymous) {
    await supabase.from("votes").delete().eq("voter_id", user.id);
  }
}

export async function signIn(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  await cleanupAnonymousVotes(supabase);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const suspension = await suspensionMessage(supabase, user.id);
    if (suspension) {
      await supabase.auth.signOut();
      return { error: suspension };
    }
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const username = String(formData.get("username") ?? "");
  const agree = formData.get("agree") === "on";

  if (username.trim().length < 2) {
    return { error: "닉네임은 2자 이상이어야 합니다." };
  }

  if (!agree) {
    return { error: "이용약관 및 개인정보처리방침에 동의해주세요." };
  }

  const supabase = await createClient();
  await cleanupAnonymousVotes(supabase);
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
