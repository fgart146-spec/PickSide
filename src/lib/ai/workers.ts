import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { POLL_CATEGORIES } from "@/lib/categories";
import { PRIVATE_IMAGE_BUCKET } from "@/lib/supabase/service";
import { getProvider } from "@/lib/ai/provider";
import {
  REPORT_ACTIONS,
  REPORT_ACTION_LABEL,
  type AiWorker,
  type AnalyticsReportType,
} from "@/lib/ai/constants";
import {
  ValidationError,
  validateReportReview,
  validatePollDraft,
  validateAnalytics,
  draftContentHash,
  type ImagePayload,
} from "@/lib/ai/validation";

type Service = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Job log helpers (공통 작업 기록)
// ---------------------------------------------------------------------------

async function createJob(
  service: Service,
  params: {
    worker: AiWorker;
    kind: string;
    trigger?: "manual" | "cron" | "import";
    status?: "queued" | "running" | "completed" | "failed";
    request?: unknown;
    inputRange?: unknown;
    createdBy: string | null;
  }
): Promise<string> {
  const provider = getProvider();
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("ai_jobs")
    .insert({
      worker: params.worker,
      kind: params.kind,
      trigger: params.trigger ?? "manual",
      status: params.status ?? "queued",
      provider: provider.id,
      request: (params.request ?? null) as Database["public"]["Tables"]["ai_jobs"]["Insert"]["request"],
      input_range: (params.inputRange ?? null) as Database["public"]["Tables"]["ai_jobs"]["Insert"]["input_range"],
      started_at: now,
      created_by: params.createdBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`작업 로그 생성 실패: ${error?.message ?? "알 수 없는 오류"}`);
  }
  return data.id;
}

async function finishJob(
  service: Service,
  jobId: string,
  patch: {
    status: "completed" | "failed" | "cancelled";
    resultCount?: number;
    error?: string | null;
  }
): Promise<void> {
  await service
    .from("ai_jobs")
    .update({
      status: patch.status,
      result_count: patch.resultCount ?? 0,
      error: patch.error ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

// ===========================================================================
// 🛡️ Report reviewer
// ===========================================================================

const REVIEW_LIMIT = 20;

type ReportSubject = {
  source: "report" | "community_report";
  reportId: string;
  targetType: string;
  targetId: string | null;
  reason: string;
  content: string;
  reportCount: number;
  authorStatus: string;
  priorHistory: string;
};

async function gatherReportSubjects(service: Service): Promise<ReportSubject[]> {
  // Skip reports we've already saved a review for (dedupe).
  const { data: existing } = await service
    .from("ai_report_reviews")
    .select("source, report_id");
  const seen = new Set((existing ?? []).map((r) => `${r.source}:${r.report_id}`));

  const [{ data: pollReports }, { data: communityReports }] = await Promise.all([
    service
      .from("reports")
      .select("id, target_type, reason, poll_id, comment_id, polls(question, owner_id, category), comments(body, author_id)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(REVIEW_LIMIT),
    service
      .from("community_reports")
      .select("id, target_type, reason, post_id, comment_id, community_posts(title, body, author_id), community_comments(body, author_id)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(REVIEW_LIMIT),
  ]);

  const subjects: ReportSubject[] = [];

  const authorStatus = async (authorId: string | null | undefined): Promise<string> => {
    if (!authorId) return "알 수 없음";
    const { data } = await service
      .from("profiles")
      .select("banned_at, suspended_until")
      .eq("id", authorId)
      .maybeSingle();
    if (!data) return "알 수 없음";
    if (data.banned_at) return "영구 정지 이력";
    if (data.suspended_until && new Date(data.suspended_until) > new Date())
      return "정지 중";
    return "제재 없음";
  };

  for (const r of (pollReports ?? []) as unknown as Array<{
    id: string;
    target_type: string;
    reason: string;
    poll_id: string | null;
    comment_id: string | null;
    polls: { question: string; owner_id: string; category: string } | null;
    comments: { body: string; author_id: string } | null;
  }>) {
    if (seen.has(`report:${r.id}`)) continue;
    const isPoll = r.target_type === "poll";
    const targetId = isPoll ? r.poll_id : r.comment_id;
    // Cumulative report count on the same target.
    const { count } = await service
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq(isPoll ? "poll_id" : "comment_id", targetId ?? "");
    subjects.push({
      source: "report",
      reportId: r.id,
      targetType: r.target_type,
      targetId: targetId ?? null,
      reason: r.reason,
      content: isPoll
        ? `투표: ${r.polls?.question ?? "(삭제됨)"} [카테고리: ${r.polls?.category ?? "?"}]`
        : `투표 댓글: ${r.comments?.body ?? "(삭제됨)"}`,
      reportCount: count ?? 1,
      authorStatus: await authorStatus(isPoll ? r.polls?.owner_id : r.comments?.author_id),
      priorHistory: "기존 처리 이력 없음",
    });
  }

  for (const r of (communityReports ?? []) as unknown as Array<{
    id: string;
    target_type: string;
    reason: string;
    post_id: string | null;
    comment_id: string | null;
    community_posts: { title: string; body: string; author_id: string } | null;
    community_comments: { body: string; author_id: string } | null;
  }>) {
    if (seen.has(`community_report:${r.id}`)) continue;
    const isPost = r.target_type === "post";
    const targetId = isPost ? r.post_id : r.comment_id;
    const { count } = await service
      .from("community_reports")
      .select("*", { count: "exact", head: true })
      .eq(isPost ? "post_id" : "comment_id", targetId ?? "");
    subjects.push({
      source: "community_report",
      reportId: r.id,
      targetType: r.target_type,
      targetId: targetId ?? null,
      reason: r.reason,
      content: isPost
        ? `게시글: ${r.community_posts?.title ?? "(삭제됨)"}\n${r.community_posts?.body ?? ""}`.slice(0, 600)
        : `커뮤니티 댓글: ${r.community_comments?.body ?? "(삭제됨)"}`,
      reportCount: count ?? 1,
      authorStatus: await authorStatus(
        isPost ? r.community_posts?.author_id : r.community_comments?.author_id
      ),
      priorHistory: "기존 처리 이력 없음",
    });
  }

  return subjects;
}

export async function buildReportReviewRequest(
  service: Service,
  createdBy: string | null
): Promise<{ jobId: string; request: unknown; count: number }> {
  const subjects = await gatherReportSubjects(service);

  const request = {
    taskType: "report_review_request",
    generatedAt: new Date().toISOString(),
    instructions:
      "각 신고 항목에 대해 콘텐츠가 운영 정책(욕설·혐오·스팸·성적/폭력적 내용·개인정보 노출 등)을 위반하는지 판단하고, 아래 allowedActions 중 하나를 recommendation으로 고르세요. 직접 처리하지 말고 추천만 하세요.",
    policy:
      "위반이 아니면 dismiss/keep, 위반이면 hide/delete, 성인성 콘텐츠는 reclassify_adult, 분류 오류는 change_category, 반복 위반 작성자는 warn_author, 판단이 어려우면 admin_review.",
    allowedActions: REPORT_ACTIONS.map((a) => ({ value: a, label: REPORT_ACTION_LABEL[a] })),
    categories: POLL_CATEGORIES,
    reports: subjects.map((s) => ({
      source: s.source,
      reportId: s.reportId,
      targetType: s.targetType,
      targetId: s.targetId,
      reason: s.reason,
      content: s.content,
      reportCount: s.reportCount,
      authorStatus: s.authorStatus,
      priorHistory: s.priorHistory,
    })),
    resultSchema: {
      taskType: "report_review",
      reportId: "<위 reportId 그대로>",
      source: "report | community_report",
      recommendation: `one of: ${REPORT_ACTIONS.join(", ")}`,
      riskLevel: "low | medium | high",
      confidence: "0.0 ~ 1.0",
      reason: "한국어 근거 (필수)",
      requiresHumanReview: true,
      suggestedCategory: "change_category 인 경우에만",
    },
  };

  const jobId = await createJob(service, {
    worker: "report_review",
    kind: "report_review_request",
    status: subjects.length > 0 ? "queued" : "completed",
    request,
    inputRange: { pendingReports: subjects.length, limit: REVIEW_LIMIT },
    createdBy,
  });

  if (subjects.length === 0) {
    await finishJob(service, jobId, { status: "completed", resultCount: 0 });
  }

  return { jobId, request, count: subjects.length };
}

// Import validated report-review results and save recommendations.
export async function importReportReviews(
  service: Service,
  createdBy: string | null,
  rawResults: unknown[]
): Promise<{ saved: number; skipped: number; jobId: string }> {
  const jobId = await createJob(service, {
    worker: "report_review",
    kind: "report_review_import",
    trigger: "import",
    status: "running",
    createdBy,
  });

  // Map reportId → source so an omitted source can be resolved from live data.
  const subjects = await gatherReportSubjects(service);
  const sourceById = new Map(subjects.map((s) => [s.reportId, s]));

  let saved = 0;
  let skipped = 0;

  try {
    for (const raw of rawResults) {
      const parsed = validateReportReview(raw);
      const subject = sourceById.get(parsed.reportId);
      const source = parsed.source ?? subject?.source;
      if (!source) {
        skipped++;
        continue; // unknown / already-reviewed report id
      }

      const { error } = await service.from("ai_report_reviews").insert({
        job_id: jobId,
        source,
        report_id: parsed.reportId,
        target_type: subject?.targetType ?? null,
        target_id: subject?.targetId ?? null,
        reason: subject?.reason ?? null,
        report_count: subject?.reportCount ?? 1,
        recommended_action: parsed.recommendation,
        rationale: parsed.reason,
        risk_level: parsed.riskLevel,
        confidence: parsed.confidence,
        requires_human_review: parsed.requiresHumanReview,
        suggested_category: parsed.suggestedCategory,
        status: "analyzed",
      });
      // Unique-index violation = duplicate save; count as skipped, not fatal.
      if (error) skipped++;
      else saved++;
    }

    await finishJob(service, jobId, { status: "completed", resultCount: saved });
  } catch (e) {
    const message = e instanceof ValidationError ? e.message : "가져오기 실패";
    await finishJob(service, jobId, { status: "failed", resultCount: saved, error: message });
    throw e;
  }

  return { saved, skipped, jobId };
}

// ===========================================================================
// ✍️ Content planner
// ===========================================================================

const DRAFT_COUNT = 4;

// Upload a validated base64 image into the private bucket. Returns the storage
// path, or null on any failure (image stays optional — never fatal).
async function uploadDraftImage(
  service: Service,
  draftId: string,
  slot: "a" | "b" | "cover",
  img: ImagePayload | null
): Promise<string | null> {
  if (!img) return null;
  const path = `ai-drafts/${draftId}/${slot}.${img.ext}`;
  const bytes = Buffer.from(img.base64, "base64");
  const { error } = await service.storage
    .from(PRIVATE_IMAGE_BUCKET)
    .upload(path, bytes, { contentType: img.contentType, upsert: true });
  return error ? null : path;
}

export async function buildContentPlanRequest(
  service: Service,
  createdBy: string | null
): Promise<{ jobId: string; request: unknown }> {
  const { data: recent } = await service
    .from("polls")
    .select("question")
    .order("created_at", { ascending: false })
    .limit(40);
  const { data: drafts } = await service
    .from("ai_poll_drafts")
    .select("title")
    .order("created_at", { ascending: false })
    .limit(40);

  const request = {
    taskType: "poll_draft_request",
    generatedAt: new Date().toISOString(),
    count: DRAFT_COUNT,
    instructions:
      "서로 다른 주제의 재미있는 양자택일(밸런스) 투표 초안을 만들어주세요. 정치·종교·혐오는 피하고 대중적인 주제를 고르세요. 아래 recentQuestions/existingDraftTitles 와 겹치지 않게 하고, 겹칠 가능성이 있으면 duplicateRisk 로 표시하세요.",
    categories: POLL_CATEGORIES,
    recentQuestions: (recent ?? []).map((p) => p.question),
    existingDraftTitles: (drafts ?? []).map((d) => d.title),
    resultSchema: {
      taskType: "poll_draft",
      title: "질문 한 문장",
      optionA: "선택지 A",
      optionB: "선택지 B",
      description: "설명(선택)",
      category: `one of: ${POLL_CATEGORIES.join(", ")}`,
      tags: ["태그1", "태그2"],
      imagePromptA: "선택지 A 이미지 생성 프롬프트(선택)",
      imagePromptB: "선택지 B 이미지 생성 프롬프트(선택)",
      coverImagePrompt: "대표 이미지 프롬프트(선택)",
      imageA: "선택지 A 이미지 data URI(선택, 예: data:image/png;base64,...) — 최대 2MB",
      imageB: "선택지 B 이미지 data URI(선택)",
      coverImage: "대표 이미지 data URI(선택, 투표에는 첨부되지 않고 미리보기용)",
      adultOnly: false,
      featured: false,
      expectedAudience: "예상 관심 대상(선택)",
      duplicateRisk: "low | medium | high",
      rationale: "기획 의도(선택)",
      status: "pending",
    },
  };

  const jobId = await createJob(service, {
    worker: "content_plan",
    kind: "poll_draft_request",
    status: "queued",
    request,
    inputRange: { recentPolls: recent?.length ?? 0 },
    createdBy,
  });

  return { jobId, request };
}

export async function importPollDrafts(
  service: Service,
  createdBy: string | null,
  rawResults: unknown[]
): Promise<{ saved: number; skipped: number; jobId: string }> {
  const jobId = await createJob(service, {
    worker: "content_plan",
    kind: "poll_draft_import",
    trigger: "import",
    status: "running",
    createdBy,
  });

  let saved = 0;
  let skipped = 0;

  try {
    for (const raw of rawResults) {
      const d = validatePollDraft(raw);
      const hash = draftContentHash(d);
      const { data: inserted, error } = await service
        .from("ai_poll_drafts")
        .insert({
          job_id: jobId,
          title: d.title,
          option_a: d.optionA,
          option_b: d.optionB,
          description: d.description || null,
          category: d.category,
          tags: d.tags,
          image_prompt_a: d.imagePromptA || null,
          image_prompt_b: d.imagePromptB || null,
          cover_image_prompt: d.coverImagePrompt || null,
          adult_only: d.adultOnly,
          featured: d.featured,
          expected_audience: d.expectedAudience || null,
          duplicate_risk: d.duplicateRisk,
          rationale: d.rationale || null,
          status: "pending", // 항상 pending — 관리자가 승인해야 게시됨
          content_hash: hash,
        })
        .select("id")
        .single();
      if (error || !inserted) {
        skipped++; // dup hash or constraint → skip
        continue;
      }
      saved++;

      // Store any base64 images into the private bucket and link their paths.
      const patch: {
        image_path_a?: string;
        image_path_b?: string;
        cover_image_path?: string;
      } = {};
      const [pa, pb, pc] = await Promise.all([
        uploadDraftImage(service, inserted.id, "a", d.imageA),
        uploadDraftImage(service, inserted.id, "b", d.imageB),
        uploadDraftImage(service, inserted.id, "cover", d.coverImage),
      ]);
      if (pa) patch.image_path_a = pa;
      if (pb) patch.image_path_b = pb;
      if (pc) patch.cover_image_path = pc;
      if (Object.keys(patch).length > 0) {
        await service.from("ai_poll_drafts").update(patch).eq("id", inserted.id);
      }
    }
    await finishJob(service, jobId, { status: "completed", resultCount: saved });
  } catch (e) {
    const message = e instanceof ValidationError ? e.message : "가져오기 실패";
    await finishJob(service, jobId, { status: "failed", resultCount: saved, error: message });
    throw e;
  }

  return { saved, skipped, jobId };
}

// ===========================================================================
// 📊 Analytics reporter — computed server-side from REAL data only.
// ===========================================================================

const PERIOD_DAYS: Record<AnalyticsReportType, number> = {
  manual: 1,
  daily: 1,
  weekly: 7,
  monthly: 30,
};

// Metrics the project does NOT currently collect — surfaced as warnings so the
// report never fabricates them.
const UNCOLLECTED_METRICS = [
  "방문자 수 / DAU",
  "이탈률 / 평균 체류 시간 / 재방문율",
  "시간대별 이용량",
  "PC·모바일 비율",
  "성인 카테고리 이용 현황",
  "광고 노출·클릭 데이터",
];

const headCount = { count: "exact" as const, head: true };

export async function generateAnalyticsReport(
  service: Service,
  reportType: AnalyticsReportType,
  createdBy: string | null,
  trigger: "manual" | "cron" = "manual"
): Promise<{ jobId: string; reportId: string }> {
  const days = PERIOD_DAYS[reportType];
  const periodStart = daysAgo(days);
  const prevStart = daysAgo(days * 2);
  const today = startOfToday();

  const jobId = await createJob(service, {
    worker: "analytics",
    kind: `analytics_${reportType}`,
    trigger,
    status: "running",
    inputRange: { periodStart, periodEnd: new Date().toISOString() },
    createdBy,
  });

  try {
    const [
      publishedPolls,
      pendingPolls,
      totalVotes,
      totalComments,
      reportsPending,
      communityReportsPending,
      newPollsToday,
      newVotesToday,
      newUsersToday,
      newPollsPeriod,
      newVotesPeriod,
      newVotesPrev,
    ] = await Promise.all([
      service.from("polls").select("*", headCount).eq("status", "published").is("deleted_at", null),
      service.from("polls").select("*", headCount).eq("status", "pending").is("deleted_at", null),
      service.from("votes").select("*", headCount),
      service.from("comments").select("*", headCount).is("deleted_at", null),
      service.from("reports").select("*", headCount).eq("status", "pending"),
      service.from("community_reports").select("*", headCount).eq("status", "pending"),
      service.from("polls").select("*", headCount).gte("created_at", today),
      service.from("votes").select("*", headCount).gte("created_at", today),
      service.from("profiles").select("*", headCount).gte("created_at", today),
      service.from("polls").select("*", headCount).gte("created_at", periodStart),
      service.from("votes").select("*", headCount).gte("created_at", periodStart),
      service.from("votes").select("*", headCount).gte("created_at", prevStart).lt("created_at", periodStart),
    ]);

    // Participation per category (real vote counts via inner join on polls).
    const votesByCategory: Record<string, number> = {};
    await Promise.all(
      POLL_CATEGORIES.map(async (cat) => {
        const { count } = await service
          .from("votes")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .select("poll_id, polls!inner(category)", headCount as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .eq("polls.category" as any, cat);
        votesByCategory[cat] = count ?? 0;
      })
    );

    const { data: topPolls } = await service
      .from("polls")
      .select("id, question, view_count")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("view_count", { ascending: false })
      .limit(5);

    const { data: lowPolls } = await service
      .from("polls")
      .select("id, question, view_count")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("view_count", { ascending: true })
      .limit(5);

    const votesPeriod = newVotesPeriod.count ?? 0;
    const votesPrev = newVotesPrev.count ?? 0;
    const voteDelta = votesPeriod - votesPrev;
    const topCategory =
      Object.entries(votesByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "없음";

    const metrics = {
      published_polls: publishedPolls.count ?? 0,
      pending_polls: pendingPolls.count ?? 0,
      total_votes: totalVotes.count ?? 0,
      total_comments: totalComments.count ?? 0,
      pending_reports: (reportsPending.count ?? 0) + (communityReportsPending.count ?? 0),
      new_polls_today: newPollsToday.count ?? 0,
      new_votes_today: newVotesToday.count ?? 0,
      new_users_today: newUsersToday.count ?? 0,
      new_polls_period: newPollsPeriod.count ?? 0,
      votes_period: votesPeriod,
      votes_prev_period: votesPrev,
      vote_delta: voteDelta,
      votes_by_category: votesByCategory,
      top_polls: topPolls ?? [],
      low_polls: lowPolls ?? [],
    };

    const changeText =
      voteDelta === 0
        ? "직전 기간과 동일합니다"
        : voteDelta > 0
        ? `직전 기간 대비 투표 참여가 ${voteDelta}건 증가했습니다`
        : `직전 기간 대비 투표 참여가 ${Math.abs(voteDelta)}건 감소했습니다`;

    const summary =
      `게시된 투표 ${metrics.published_polls}개, 총 투표 참여 ${metrics.total_votes}건. ` +
      `${changeText}. 참여가 가장 많은 카테고리는 '${topCategory}'입니다. ` +
      `승인 대기 투표 ${metrics.pending_polls}개, 처리 대기 신고 ${metrics.pending_reports}건.`;

    const highlights = [
      `오늘 신규 투표 ${metrics.new_polls_today}개 · 신규 투표참여 ${metrics.new_votes_today}건 · 신규 가입 ${metrics.new_users_today}명`,
      `인기 투표: ${(topPolls ?? []).map((p) => p.question).slice(0, 3).join(" / ") || "없음"}`,
      `참여율 낮은 투표: ${(lowPolls ?? []).map((p) => p.question).slice(0, 3).join(" / ") || "없음"}`,
    ];

    const warnings: string[] = [];
    if (metrics.pending_reports > 0)
      warnings.push(`처리 대기 신고 ${metrics.pending_reports}건 — 신고 검토 필요`);
    if (metrics.pending_polls > 0)
      warnings.push(`승인 대기 투표 ${metrics.pending_polls}개 — 승인 관리 확인 필요`);

    const recommendations: string[] = [];
    if (metrics.pending_reports > 0) recommendations.push("신고 검토관 결과를 확인해 신고를 처리하세요.");
    if (metrics.pending_polls > 0) recommendations.push("승인 대기 투표를 검토해 게시 여부를 결정하세요.");
    if ((lowPolls ?? []).length > 0)
      recommendations.push("참여율이 낮은 투표는 노출 위치나 제목을 조정해 보세요.");

    const now = new Date();
    const { data: report, error } = await service
      .from("ai_analytics_reports")
      .insert({
        job_id: jobId,
        title: `${reportType === "manual" ? "직접" : reportType === "daily" ? "일간" : reportType === "weekly" ? "주간" : "월간"} 리포트 · ${now.toLocaleDateString("ko-KR")}`,
        report_type: reportType,
        period_start: periodStart.slice(0, 10),
        period_end: now.toISOString().slice(0, 10),
        metrics: metrics as Database["public"]["Tables"]["ai_analytics_reports"]["Insert"]["metrics"],
        summary,
        details:
          `분석 기간: 최근 ${days}일. 모든 수치는 실제 수집 데이터 기준입니다.\n` +
          `현재 수집하지 않아 제외된 지표: ${UNCOLLECTED_METRICS.join(", ")}.`,
        highlights: highlights as Database["public"]["Tables"]["ai_analytics_reports"]["Insert"]["highlights"],
        warnings: warnings as Database["public"]["Tables"]["ai_analytics_reports"]["Insert"]["warnings"],
        recommendations: recommendations as Database["public"]["Tables"]["ai_analytics_reports"]["Insert"]["recommendations"],
        data_scope: `polls, votes, comments, reports, profiles (최근 ${days}일)`,
        data_missing: true,
      })
      .select("id")
      .single();

    if (error || !report) throw new Error(error?.message ?? "리포트 저장 실패");

    await finishJob(service, jobId, { status: "completed", resultCount: 1 });
    return { jobId, reportId: report.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "리포트 생성 실패";
    await finishJob(service, jobId, { status: "failed", error: message });
    throw e;
  }
}

// Optional: import a Claude-Code-written narrative to enrich the latest report
// numbers (kept for parity with the documented analytics_report JSON).
export async function importAnalyticsNarrative(
  service: Service,
  createdBy: string | null,
  raw: unknown
): Promise<{ reportId: string; jobId: string }> {
  const parsed = validateAnalytics(raw);
  const jobId = await createJob(service, {
    worker: "analytics",
    kind: "analytics_import",
    trigger: "import",
    status: "running",
    createdBy,
  });
  try {
    const { data: report, error } = await service
      .from("ai_analytics_reports")
      .insert({
        job_id: jobId,
        title: `가져온 리포트 · ${new Date().toLocaleDateString("ko-KR")}`,
        report_type: parsed.reportType,
        period_start: parsed.periodStart,
        period_end: parsed.periodEnd,
        summary: parsed.summary || null,
        details: parsed.details || null,
        highlights: parsed.highlights as Database["public"]["Tables"]["ai_analytics_reports"]["Insert"]["highlights"],
        warnings: parsed.warnings as Database["public"]["Tables"]["ai_analytics_reports"]["Insert"]["warnings"],
        recommendations: parsed.recommendations as Database["public"]["Tables"]["ai_analytics_reports"]["Insert"]["recommendations"],
        data_scope: "Claude Code 가져오기",
        data_missing: false,
      })
      .select("id")
      .single();
    if (error || !report) throw new Error(error?.message ?? "리포트 저장 실패");
    await finishJob(service, jobId, { status: "completed", resultCount: 1 });
    return { reportId: report.id, jobId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "가져오기 실패";
    await finishJob(service, jobId, { status: "failed", error: message });
    throw e;
  }
}
