import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  buildReportReviewRequest,
  buildContentPlanRequest,
  generateAnalyticsReport,
} from "@/lib/ai/workers";

// Scheduled AI office prep. Triggered by Vercel Cron (see vercel.json) with
// `Authorization: Bearer $CRON_SECRET`.
//
// This does NOT call any AI model. In the manual (Claude Code) model the cron
// only: (1) generates a daily analytics report — fully computed server-side
// from real data — and (2) queues fresh request specs for the report reviewer
// and content planner. Those requests wait until Claude Code fulfills them and
// an admin imports the results. Nothing goes live automatically.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET이 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const results: Record<string, unknown> = {};

  try {
    const analytics = await generateAnalyticsReport(service, "daily", null, "cron");
    results.analytics = analytics.reportId;
  } catch (e) {
    results.analytics_error = e instanceof Error ? e.message : String(e);
  }

  try {
    const review = await buildReportReviewRequest(service, null);
    results.report_review_request = { jobId: review.jobId, pending: review.count };
  } catch (e) {
    results.report_review_error = e instanceof Error ? e.message : String(e);
  }

  try {
    const content = await buildContentPlanRequest(service, null);
    results.content_plan_request = content.jobId;
  } catch (e) {
    results.content_plan_error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({ ok: true, results });
}
