"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PRIVATE_IMAGE_BUCKET } from "@/lib/supabase/service";
import { isPollCategory } from "@/lib/categories";
import { suspensionMessage } from "@/lib/moderation";

export type CreatePollState = { error: string | null };

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function extensionFor(file: File): string {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  if (byType[file.type]) return byType[file.type];
  const fromName = file.name.split(".").pop();
  return fromName && fromName.length <= 5 ? fromName.toLowerCase() : "jpg";
}

export async function createPoll(
  _prevState: CreatePollState,
  formData: FormData
): Promise<CreatePollState> {
  const question = String(formData.get("question") ?? "").trim();
  const optionA = String(formData.get("optionA") ?? "").trim();
  const optionB = String(formData.get("optionB") ?? "").trim();
  const categoryInput = String(formData.get("category") ?? "");
  const imageA = formData.get("imageA");
  const imageB = formData.get("imageB");

  if (!question || !optionA || !optionB) {
    return { error: "질문과 두 선택지를 모두 입력해주세요." };
  }

  if (!isPollCategory(categoryInput)) {
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

  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .insert({ question, owner_id: user.id, category: categoryInput })
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

    const path = `${poll.id}/${option.id}.${extensionFor(image)}`;
    const { error: uploadError } = await supabase.storage
      .from(PRIVATE_IMAGE_BUCKET)
      .upload(path, image, { contentType: image.type, upsert: true });

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
