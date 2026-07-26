"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { isPollCategory } from "@/lib/categories";
import {
  buildReportReviewRequest,
  buildContentPlanRequest,
  generateAnalyticsReport,
} from "@/lib/ai/workers";
import { importResultPayload } from "@/lib/ai/office";
import {
  REPORT_TYPES,
  REPORT_ACTIONS,
  type AnalyticsReportType,
  type ReportAction,
} from "@/lib/ai/constants";
import { sanitizeText, normalizeCategory } from "@/lib/ai/validation";

const OFFICE = "/admin/office";
const REPORTS = "/admin/office/reports";
const DRAFTS = "/admin/office/drafts";
const ANALYTICS = "/admin/office/analytics";

// ===========================================================================
// Request generation (작업 요청 생성) — no model call; builds a request spec.
// ===========================================================================

export async function generateReportRequest() {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();
  await buildReportReviewRequest(service, adminId);
  revalidatePath(REPORTS);
  revalidatePath(OFFICE);
}

export async function generateContentRequest() {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();
  await buildContentPlanRequest(service, adminId);
  revalidatePath(DRAFTS);
  revalidatePath(OFFICE);
}

export async function generateAnalytics(formData: FormData) {
  const { adminId } = await requireAdmin();
  const raw = String(formData.get("reportType") ?? "manual");
  const reportType = (REPORT_TYPES as readonly string[]).includes(raw)
    ? (raw as AnalyticsReportType)
    : "manual";
  const service = createServiceClient();
  await generateAnalyticsReport(service, reportType, adminId);
  revalidatePath(ANALYTICS);
  revalidatePath(OFFICE);
}

// ===========================================================================
// Result import (결과 JSON 업로드 / 생성 결과 가져오기)
// ===========================================================================

export async function importResults(formData: FormData) {
  const { adminId } = await requireAdmin();

  // Accept either a pasted textarea or an uploaded .json file.
  let jsonText = String(formData.get("json") ?? "").trim();
  const file = formData.get("file");
  if (!jsonText && file instanceof File && file.size > 0) {
    jsonText = (await file.text()).trim();
  }
  if (!jsonText) {
    throw new Error("가져올 JSON을 입력하거나 파일을 선택하세요.");
  }

  const service = createServiceClient();
  const summaries = await importResultPayload(service, adminId, jsonText);

  await logAdminAction(service, {
    adminId,
    action: "ai.import",
    targetType: "ai_office",
    reason: summaries.map((s) => `${s.worker}:${s.saved}저장/${s.skipped}건너뜀`).join(", "),
  });

  revalidatePath(REPORTS);
  revalidatePath(DRAFTS);
  revalidatePath(ANALYTICS);
  revalidatePath(OFFICE);
}

// ===========================================================================
// 🛡️ Report review decisions — the state-changing part stays behind approval.
// ===========================================================================

type ReviewRow = {
  id: string;
  source: "report" | "community_report";
  report_id: string;
  target_type: string | null;
  target_id: string | null;
  recommended_action: ReportAction;
  suggested_category: string | null;
  status: string;
};

async function loadReview(reviewId: string): Promise<ReviewRow> {
  const service = createServiceClient();
  const { data } = await service
    .from("ai_report_reviews")
    .select("id, source, report_id, target_type, target_id, recommended_action, suggested_category, status")
    .eq("id", reviewId)
    .single();
  if (!data) throw new Error("추천을 찾을 수 없습니다.");
  return data as ReviewRow;
}

// Perform the concrete live-content change for an action. Uses the admin's
// authed client so RLS admin policies apply. Returns a human description.
async function applyAction(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  review: ReviewRow,
  action: ReportAction,
  adminId: string,
  note: string | null
): Promise<string> {
  const reportTable = review.source === "report" ? "reports" : "community_reports";
  const now = new Date().toISOString();

  const resolveReport = async (status: "resolved" | "dismissed") => {
    await supabase
      .from(reportTable)
      .update({ status, resolution_note: note ? `[AI] ${note}` : "[AI 추천 적용]" })
      .eq("id", review.report_id);
  };

  // Which content table + id does this report target?
  const target = (() => {
    if (review.source === "report") {
      return review.target_type === "poll"
        ? { table: "polls" as const, id: review.target_id }
        : { table: "comments" as const, id: review.target_id };
    }
    return review.target_type === "post"
      ? { table: "community_posts" as const, id: review.target_id }
      : { table: "community_comments" as const, id: review.target_id };
  })();

  switch (action) {
    case "dismiss":
      await resolveReport("dismissed");
      return "신고 기각";
    case "keep":
      await resolveReport("resolved");
      return "콘텐츠 유지";
    case "hide": {
      if (target.id) {
        if (target.table === "polls") {
          await supabase.from("polls").update({ status: "hidden" }).eq("id", target.id);
        } else {
          await supabase.from(target.table).update({ deleted_at: now }).eq("id", target.id);
        }
      }
      await resolveReport("resolved");
      return "콘텐츠 숨김";
    }
    case "delete": {
      if (target.id) {
        await supabase.from(target.table).update({ deleted_at: now }).eq("id", target.id);
      }
      await resolveReport("resolved");
      return "콘텐츠 삭제";
    }
    case "change_category": {
      const cat = normalizeCategory(review.suggested_category ?? "");
      if (target.table === "polls" && target.id && isPollCategory(cat)) {
        await supabase.from("polls").update({ category: cat }).eq("id", target.id);
      }
      await resolveReport("resolved");
      return `카테고리 변경 → ${cat}`;
    }
    case "reclassify_adult":
      // 성인 재분류 전용 컬럼이 없어 콘텐츠는 변경하지 않고 신고만 처리 완료로 둡니다.
      await resolveReport("resolved");
      return "성인 콘텐츠로 재분류(수동 후속 처리 필요)";
    case "warn_author":
      await resolveReport("resolved");
      return "작성자 경고 기록";
    case "admin_review":
      return "관리자 추가 검토";
  }
}

// 추천 적용 — apply the AI's recommended action.
export async function applyReviewRecommendation(reviewId: string) {
  const { supabase, adminId } = await requireAdmin();
  const service = createServiceClient();
  const review = await loadReview(reviewId);
  if (review.status === "resolved") throw new Error("이미 처리된 추천입니다.");

  const desc = await applyAction(supabase, review, review.recommended_action, adminId, null);

  await service
    .from("ai_report_reviews")
    .update({
      status: review.recommended_action === "admin_review" ? "admin_reviewing" : "resolved",
      admin_decision: `추천 적용: ${desc}`,
      admin_id: adminId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", reviewId);

  await logAdminAction(supabase, {
    adminId,
    action: "ai.review.apply",
    targetType: review.source,
    targetId: review.report_id,
    reason: desc,
  });

  revalidatePath(REPORTS);
  revalidatePath("/admin/reports");
}

// 직접 처리 — admin picks the action manually (may differ from the AI's).
export async function directResolveReview(reviewId: string, formData: FormData) {
  const { supabase, adminId } = await requireAdmin();
  const service = createServiceClient();
  const review = await loadReview(reviewId);

  const raw = String(formData.get("action") ?? "");
  if (!(REPORT_ACTIONS as readonly string[]).includes(raw)) {
    throw new Error("잘못된 조치입니다.");
  }
  const note = sanitizeText(formData.get("note"), 500) || null;
  const desc = await applyAction(supabase, review, raw as ReportAction, adminId, note);

  await service
    .from("ai_report_reviews")
    .update({
      status: "resolved",
      admin_decision: `직접 처리: ${desc}`,
      admin_note: note,
      admin_id: adminId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", reviewId);

  await logAdminAction(supabase, {
    adminId,
    action: "ai.review.direct",
    targetType: review.source,
    targetId: review.report_id,
    reason: desc,
  });

  revalidatePath(REPORTS);
  revalidatePath("/admin/reports");
}

// 기각 — dismiss the AI recommendation and the underlying report.
export async function dismissReview(reviewId: string) {
  const { supabase, adminId } = await requireAdmin();
  const service = createServiceClient();
  const review = await loadReview(reviewId);

  await supabase
    .from(review.source === "report" ? "reports" : "community_reports")
    .update({ status: "dismissed", resolution_note: "[AI 추천 기각]" })
    .eq("id", review.report_id);

  await service
    .from("ai_report_reviews")
    .update({
      status: "resolved",
      admin_decision: "기각",
      admin_id: adminId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", reviewId);

  revalidatePath(REPORTS);
  revalidatePath("/admin/reports");
}

// 보류 — hold for later.
export async function holdReview(reviewId: string) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();
  await service
    .from("ai_report_reviews")
    .update({ status: "held", admin_id: adminId, decided_at: new Date().toISOString() })
    .eq("id", reviewId);
  revalidatePath(REPORTS);
}

// ===========================================================================
// ✍️ Poll draft decisions
// ===========================================================================

// 승인 — materialize the draft into a real poll (status pending) so it flows
// through the EXISTING /admin/polls approval screen before going live.
export async function approveDraft(draftId: string) {
  const { supabase, adminId } = await requireAdmin();
  const service = createServiceClient();

  const { data: draft } = await service
    .from("ai_poll_drafts")
    .select("id, title, option_a, option_b, category, featured, status, poll_id, image_path_a, image_path_b")
    .eq("id", draftId)
    .single();
  if (!draft) throw new Error("초안을 찾을 수 없습니다.");
  if (draft.status === "approved" || draft.status === "published") {
    throw new Error("이미 승인된 초안입니다.");
  }

  const category = isPollCategory(draft.category) ? draft.category : "기타";

  const { data: poll, error: pollErr } = await service
    .from("polls")
    .insert({
      owner_id: adminId,
      question: draft.title,
      status: "pending", // 관리자 승인 관리에서 최종 게시
      category,
      is_featured: draft.featured,
    })
    .select("id")
    .single();
  if (pollErr || !poll) throw new Error(pollErr?.message ?? "투표 생성 실패");

  const { error: optErr } = await service.from("poll_options").insert([
    { poll_id: poll.id, label: draft.option_a, position: 0, image_path: draft.image_path_a ?? null },
    { poll_id: poll.id, label: draft.option_b, position: 1, image_path: draft.image_path_b ?? null },
  ]);
  if (optErr) {
    await service.from("polls").delete().eq("id", poll.id);
    throw new Error(optErr.message);
  }

  await service
    .from("ai_poll_drafts")
    .update({
      status: "approved",
      poll_id: poll.id,
      admin_id: adminId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  await logAdminAction(supabase, {
    adminId,
    action: "ai.draft.approve",
    targetType: "poll",
    targetId: poll.id,
  });

  revalidatePath(DRAFTS);
  revalidatePath("/admin/polls");
}

export async function rejectDraft(draftId: string) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();
  await service
    .from("ai_poll_drafts")
    .update({ status: "rejected", admin_id: adminId, decided_at: new Date().toISOString() })
    .eq("id", draftId);
  revalidatePath(DRAFTS);
}

export async function archiveDraft(draftId: string) {
  const { adminId } = await requireAdmin();
  const service = createServiceClient();
  await service
    .from("ai_poll_drafts")
    .update({ status: "archived", admin_id: adminId, decided_at: new Date().toISOString() })
    .eq("id", draftId);
  revalidatePath(DRAFTS);
}

// 초안 수정 — edit title / options / description / category / flags before approval.
export async function updateDraft(draftId: string, formData: FormData) {
  await requireAdmin();
  const service = createServiceClient();

  const title = sanitizeText(formData.get("title"), 200);
  const optionA = sanitizeText(formData.get("option_a"), 80);
  const optionB = sanitizeText(formData.get("option_b"), 80);
  if (!title || !optionA || !optionB) {
    throw new Error("제목과 두 선택지는 필수입니다.");
  }

  await service
    .from("ai_poll_drafts")
    .update({
      title,
      option_a: optionA,
      option_b: optionB,
      description: sanitizeText(formData.get("description"), 500) || null,
      category: normalizeCategory(formData.get("category")),
      adult_only: formData.get("adult_only") === "on",
      featured: formData.get("featured") === "on",
    })
    .eq("id", draftId);

  revalidatePath(DRAFTS);
}

// 일괄 승인
export async function bulkApproveDrafts(formData: FormData) {
  const ids = formData.getAll("draftId").map(String);
  for (const id of ids) {
    await approveDraft(id);
  }
  revalidatePath(DRAFTS);
}

// 일괄 삭제 — permanently remove selected drafts (they never went live).
export async function bulkDeleteDrafts(formData: FormData) {
  await requireAdmin();
  const service = createServiceClient();
  const ids = formData.getAll("draftId").map(String);
  if (ids.length > 0) {
    await service.from("ai_poll_drafts").delete().in("id", ids);
  }
  revalidatePath(DRAFTS);
}

// ===========================================================================
// Job log
// ===========================================================================

export async function confirmJob(jobId: string) {
  await requireAdmin();
  const service = createServiceClient();
  await service.from("ai_jobs").update({ admin_confirmed: true }).eq("id", jobId);
  revalidatePath(OFFICE);
}
