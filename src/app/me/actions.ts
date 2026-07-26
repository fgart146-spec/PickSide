"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateUsernameState = { error: string | null; success: boolean };

export async function updateUsername(
  _prevState: UpdateUsernameState,
  formData: FormData
): Promise<UpdateUsernameState> {
  const username = String(formData.get("username") ?? "").trim();

  if (username.length < 2 || username.length > 20) {
    return { error: "닉네임은 2~20자로 입력해주세요.", success: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다.", success: false };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", user.id);

  if (error) {
    const message =
      error.code === "23505" ? "이미 사용 중인 닉네임입니다." : error.message;
    return { error: message, success: false };
  }

  revalidatePath("/me");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}
