import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { TASK_TYPE_TO_WORKER, type AiWorker } from "@/lib/ai/constants";
import { ValidationError } from "@/lib/ai/validation";
import {
  importReportReviews,
  importPollDrafts,
  importAnalyticsNarrative,
} from "@/lib/ai/workers";

type Service = SupabaseClient<Database>;

// Large enough to carry a few base64 images on poll drafts (see next.config
// serverActions.bodySizeLimit, which must be >= this).
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024; // 8MB

// Normalize whatever top-level shape the result JSON has into a flat item list.
function extractItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.reports)) return o.reports;
    if (Array.isArray(o.polls)) return o.polls;
    if (Array.isArray(o.drafts)) return o.drafts;
    return [o]; // single result object
  }
  throw new ValidationError("결과 JSON 형식을 해석할 수 없습니다.");
}

function workerOf(item: unknown): AiWorker {
  if (!item || typeof item !== "object") {
    throw new ValidationError("각 결과 항목은 객체여야 합니다.");
  }
  const taskType = String((item as Record<string, unknown>).taskType ?? "");
  const worker = TASK_TYPE_TO_WORKER[taskType];
  if (!worker) {
    throw new ValidationError(
      `알 수 없는 taskType 입니다: ${taskType || "(없음)"} (허용: ${Object.keys(TASK_TYPE_TO_WORKER).join(", ")})`
    );
  }
  return worker;
}

export type ImportSummary = {
  worker: AiWorker;
  saved: number;
  skipped: number;
};

// Parse + validate + persist an uploaded Claude Code result payload. Items may
// mix task types; each is routed to its worker's validated importer.
export async function importResultPayload(
  service: Service,
  createdBy: string | null,
  jsonText: string
): Promise<ImportSummary[]> {
  if (jsonText.length > MAX_IMPORT_BYTES) {
    throw new ValidationError("결과 JSON이 너무 큽니다 (최대 512KB).");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new ValidationError("올바른 JSON이 아닙니다.");
  }

  const items = extractItems(payload);
  if (items.length === 0) {
    throw new ValidationError("가져올 결과 항목이 없습니다.");
  }

  // Bucket items by worker.
  const byWorker = new Map<AiWorker, unknown[]>();
  for (const item of items) {
    const worker = workerOf(item);
    const bucket = byWorker.get(worker) ?? [];
    bucket.push(item);
    byWorker.set(worker, bucket);
  }

  const summaries: ImportSummary[] = [];

  for (const [worker, bucket] of byWorker) {
    if (worker === "report_review") {
      const { saved, skipped } = await importReportReviews(service, createdBy, bucket);
      summaries.push({ worker, saved, skipped });
    } else if (worker === "content_plan") {
      const { saved, skipped } = await importPollDrafts(service, createdBy, bucket);
      summaries.push({ worker, saved, skipped });
    } else if (worker === "analytics") {
      let saved = 0;
      for (const item of bucket) {
        await importAnalyticsNarrative(service, createdBy, item);
        saved++;
      }
      summaries.push({ worker, saved, skipped: 0 });
    }
  }

  return summaries;
}
