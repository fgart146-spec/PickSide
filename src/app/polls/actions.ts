"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PRIVATE_IMAGE_BUCKET } from "@/lib/supabase/service";
import { legacyCategoryFor } from "@/lib/categories";
import { suspensionMessage } from "@/lib/moderation";
import { toOptimizedWebp } from "@/lib/image-processing";

export type CreatePollState = { error: string | null };

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function createPoll(
  _prevState: CreatePollState,
  formData: FormData
): Promise<CreatePollState> {
  const question = String(formData.get("question") ?? "").trim();
  const optionA = String(formData.get("optionA") ?? "").trim();
  const optionB = String(formData.get("optionB") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "").trim();
  const imageA = formData.get("imageA");
  const imageB = formData.get("imageB");

  if (!question || !optionA || !optionB) {
    return { error: "질문과 두 선택지를 모두 입력해주세요." };
  }

  if (!categoryId) {
    return { error: "올바른 카테고리를 선택해주세요." };
  }

  for (const image of [imageA, imageB]) {
    if (image instanceof File && image.size > MAX_IMAGE_BYTES) {
      return { error: "이미지는 10MB 이하로 올려주세요." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  if (user.is_anonymous) {
    return { error: "투표를 만들려면 회원가입이 필요합니다." };
  }

  const suspension = await suspensionMessage(supabase, user.id);
  if (suspension) {
    return { error: suspension };
  }

  // Never trust the submitted category name — re-look-up the category and
  // reject anything hidden/deleted, even if someone crafts a request with a
  // stale or made-up id.
  const { data: category } = await supabase
    .from("categories")
    .select("id, name")
    .eq("id", categoryId)
    .eq("is_visible", true)
    .eq("is_deleted", false)
    .single();

  if (!category) {
    return { error: "올바른 카테고리를 선택해주세요." };
  }

  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .insert({
      question,
      owner_id: user.id,
      category_id: category.id,
      category: legacyCategoryFor(category.name),
    })
    .select("id")
    .single();

  if (pollError || !poll) {
    return { error: pollError?.message ?? "투표 생성에 실패했습니다." };
  }

  const { data: options, error: optionsError } = await supabase
    .from("poll_options")
    .insert([
      { poll_id: poll.id, label: optionA, position: 0 },
      { poll_id: poll.id, label: optionB, position: 1 },
    ])
    .select("id, position");

  if (optionsError || !options) {
    return { error: optionsError?.message ?? "선택지 생성에 실패했습니다." };
  }

  const uploads: [FormDataEntryValue | null, number][] = [
    [imageA, 0],
    [imageB, 1],
  ];

  for (const [image, position] of uploads) {
    if (!(image instanceof File) || image.size === 0) continue;

    const option = options.find((o) => o.position === position);
    if (!option) continue;

    const optimized = await toOptimizedWebp(await image.arrayBuffer(), { maxWidth: 1200 });
    const path = `${poll.id}/${option.id}.webp`;
    const { error: uploadError } = await supabase.storage
      .from(PRIVATE_IMAGE_BUCKET)
      .upload(path, optimized, { contentType: "image/webp", upsert: true });

    if (uploadError) {
      return { error: `이미지 업로드 실패: ${uploadError.message}` };
    }

    const { error: updateError } = await supabase
      .from("poll_options")
      .update({ image_path: path })
      .eq("id", option.id);

    if (updateError) {
      return { error: `이미지 경로 저장 실패: ${updateError.message}` };
    }
  }

  revalidatePath("/");
  redirect(`/polls/${poll.id}`);
}

export async function castVote(pollId: string, optionId: string) {
  const supabase = await createClient();
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  let voterId = existingUser?.id;

  if (voterId && !existingUser?.is_anonymous) {
    const suspension = await suspensionMessage(supabase, voterId);
    if (suspension) {
      throw new Error(suspension);
    }
  }

  if (!voterId) {
    // Guest voting: silently create an anonymous Supabase Auth user so the
    // browser's session cookie identifies repeat visits and one-vote-per
    // poll keeps working without requiring sign-up.
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      throw new Error(error?.message ?? "게스트 투표에 실패했습니다.");
    }
    voterId = data.user.id;
  }

  // Votes are insert-only — once cast, a vote can't be changed. Relying on
  // the unique (poll_id, voter_id) constraint here (instead of a
  // check-then-insert) avoids a race between concurrent requests from the
  // same voter.
  const { error } = await supabase
    .from("votes")
    .insert({ poll_id: pollId, option_id: optionId, voter_id: voterId });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }

  revalidatePath(`/polls/${pollId}`);
  revalidatePath("/");
}

export async function toggleBookmark(pollId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    redirect("/login");
  }

  const { data: existing } = await supabase
    .from("poll_bookmarks")
    .select("poll_id")
    .eq("poll_id", pollId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("poll_bookmarks")
      .delete()
      .eq("poll_id", pollId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("poll_bookmarks")
      .insert({ poll_id: pollId, user_id: user.id });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/polls/${pollId}`);
  revalidatePath("/me");
}
