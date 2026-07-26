"use server";

import { createClient } from "@/lib/supabase/server";

export type ReportState = { error: string | null; success: boolean };

async function createReport(
  targetType: "post" | "comment",
  targetId: string,
  _prevState: ReportState,
  formData: FormData
): Promise<ReportState> {
  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) {
    return { error: "신고 사유를 입력해주세요.", success: false };
  }
  if (reason.length > 300) {
    return { error: "신고 사유는 300자 이하로 작성해주세요.", success: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다.", success: false };
  }
  if (user.is_anonymous) {
    return { error: "신고하려면 회원가입이 필요합니다.", success: false };
  }

  const { error } = await supabase.from("community_reports").insert({
    target_type: targetType,
    post_id: targetType === "post" ? targetId : null,
    comment_id: targetType === "comment" ? targetId : null,
    reporter_id: user.id,
    reason,
  });

  if (error) {
    const message =
      error.code === "23505" ? "이미 신고한 내용입니다." : error.message;
    return { error: message, success: false };
  }

  return { error: null, success: true };
}

export async function reportPost(
  postId: string,
  prevState: ReportState,
  formData: FormData
): Promise<ReportState> {
  return createReport("post", postId, prevState, formData);
}

export async function reportComment(
  commentId: string,
  prevState: ReportState,
  formData: FormData
): Promise<ReportState> {
  return createReport("comment", commentId, prevState, formData);
}
