// Server-side validation for anything that arrives as AI-produced JSON (from a
// Claude Code result file the admin uploads). NOTHING here trusts the input:
// every field is length-capped, HTML/script-stripped, and enum-checked before
// it can reach the database. AI text is only ever used as *parameterized* data
// in Supabase inserts — never interpolated into SQL or shell commands.

import { POLL_CATEGORIES, isPollCategory } from "@/lib/categories";
import {
  REPORT_ACTIONS,
  RISK_LEVELS,
  REPORT_TYPES,
  type ReportAction,
  type RiskLevel,
  type AnalyticsReportType,
} from "@/lib/ai/constants";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Remove tags/scripts and collapse whitespace, then hard-cap the length.
// Not a full HTML sanitizer — we render as plain text, so stripping every
// angle-bracket tag plus dangerous URI schemes is enough and safe.
export function sanitizeText(value: unknown, maxLen: number): string {
  if (value == null) return "";
  const raw = String(value);
  const noTags = raw
    .replace(/<[^>]*>/g, " ") // strip <script>, <img>, any tag
    .replace(/javascript:/gi, "")
    .replace(/data:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/[\x00-\x1f\x7f]/g, " ") // control chars
    .replace(/\s+/g, " ")
    .trim();
  return noTags.slice(0, maxLen);
}

function requireString(value: unknown, field: string, maxLen: number): string {
  const clean = sanitizeText(value, maxLen);
  if (!clean) {
    throw new ValidationError(`필수 항목 '${field}'가(이) 비어 있습니다.`);
  }
  return clean;
}

function toConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, Math.round(n * 100) / 100));
}

function toEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string
): T[number] {
  const s = sanitizeText(value, 40).toLowerCase();
  if (!(allowed as readonly string[]).includes(s)) {
    throw new ValidationError(
      `'${field}' 값이 허용되지 않습니다: ${s || "(빈 값)"} (허용: ${allowed.join(", ")})`
    );
  }
  return s as T[number];
}

// Map arbitrary category strings (English synonyms, etc.) onto the project's
// fixed Korean category set, defaulting to '기타' when unknown.
const CATEGORY_SYNONYMS: Record<string, string> = {
  daily: "일상",
  life: "일상",
  일상: "일상",
  food: "음식",
  음식: "음식",
  love: "연애",
  romance: "연애",
  dating: "연애",
  연애: "연애",
  game: "게임",
  games: "게임",
  gaming: "게임",
  게임: "게임",
  balance: "밸런스",
  밸런스: "밸런스",
};

export function normalizeCategory(value: unknown): string {
  const s = sanitizeText(value, 40);
  if (isPollCategory(s)) return s;
  const mapped = CATEGORY_SYNONYMS[s.toLowerCase()];
  return mapped ?? "기타";
}

// ---------------------------------------------------------------------------
// Base64 image payloads (optional, on poll drafts)
// ---------------------------------------------------------------------------

export type ImagePayload = { base64: string; contentType: string; ext: string };

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB per image
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Validate a single image. Must be a data URI (data:image/<type>;base64,<data>)
// so the type is known and no external fetch is ever performed. Returns null for
// anything missing/invalid/oversized — images are optional and a bad one is
// dropped rather than failing the whole import.
export function validateImagePayload(value: unknown): ImagePayload | null {
  if (typeof value !== "string" || !value) return null;
  const m = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
  if (!m) return null;
  const contentType = m[1].toLowerCase();
  const ext = MIME_EXT[contentType];
  if (!ext) return null; // disallowed type
  const base64 = m[2].replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null; // not valid base64
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes === 0 || approxBytes > MAX_IMAGE_BYTES) return null;
  return { base64, contentType, ext };
}

// ---------------------------------------------------------------------------
// Result shapes (validated / normalized)
// ---------------------------------------------------------------------------

export type ReportReviewResult = {
  reportId: string;
  source?: "report" | "community_report";
  recommendation: ReportAction;
  riskLevel: RiskLevel;
  confidence: number;
  reason: string;
  requiresHumanReview: boolean;
  suggestedCategory: string | null;
};

export type PollDraftResult = {
  title: string;
  optionA: string;
  optionB: string;
  description: string;
  category: string;
  tags: string[];
  imagePromptA: string;
  imagePromptB: string;
  coverImagePrompt: string;
  adultOnly: boolean;
  featured: boolean;
  expectedAudience: string;
  duplicateRisk: RiskLevel;
  rationale: string;
  imageA: ImagePayload | null;
  imageB: ImagePayload | null;
  coverImage: ImagePayload | null;
};

export type AnalyticsResult = {
  reportType: AnalyticsReportType;
  periodStart: string | null;
  periodEnd: string | null;
  summary: string;
  details: string;
  highlights: string[];
  warnings: string[];
  recommendations: string[];
};

function asRecord(value: unknown, ctx: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError(`${ctx}: 객체 형태의 JSON이 아닙니다.`);
  }
  return value as Record<string, unknown>;
}

const isoDate = (value: unknown): string | null => {
  const s = sanitizeText(value, 32);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

const asStringArray = (value: unknown, maxItems: number, maxLen: number): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => sanitizeText(v, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
};

export function validateReportReview(input: unknown): ReportReviewResult {
  const o = asRecord(input, "신고 검토 결과");
  const source =
    o.source === "report" || o.source === "community_report"
      ? o.source
      : undefined;
  const rec = o.recommendation ?? o.recommended_action ?? o.action;
  return {
    reportId: requireString(o.reportId ?? o.report_id, "reportId", 100),
    source,
    recommendation: toEnum(rec, REPORT_ACTIONS, "recommendation"),
    riskLevel: toEnum(o.riskLevel ?? o.risk_level ?? "low", RISK_LEVELS, "riskLevel"),
    confidence: toConfidence(o.confidence),
    reason: requireString(o.reason ?? o.rationale, "reason", 1000),
    requiresHumanReview:
      o.requiresHumanReview === undefined ? true : Boolean(o.requiresHumanReview),
    suggestedCategory:
      o.suggestedCategory || o.suggested_category
        ? normalizeCategory(o.suggestedCategory ?? o.suggested_category)
        : null,
  };
}

export function validatePollDraft(input: unknown): PollDraftResult {
  const o = asRecord(input, "투표 초안");
  const category = normalizeCategory(o.category);
  if (!POLL_CATEGORIES.includes(category as (typeof POLL_CATEGORIES)[number])) {
    throw new ValidationError(`허용되지 않은 카테고리입니다: ${category}`);
  }
  return {
    title: requireString(o.title ?? o.question, "title", 200),
    optionA: requireString(o.optionA ?? o.option_a, "optionA", 80),
    optionB: requireString(o.optionB ?? o.option_b, "optionB", 80),
    description: sanitizeText(o.description, 500),
    category,
    tags: asStringArray(o.tags, 8, 30),
    imagePromptA: sanitizeText(o.imagePromptA ?? o.image_prompt_a, 500),
    imagePromptB: sanitizeText(o.imagePromptB ?? o.image_prompt_b, 500),
    coverImagePrompt: sanitizeText(o.coverImagePrompt ?? o.cover_image_prompt, 500),
    adultOnly: Boolean(o.adultOnly ?? o.adult_only ?? false),
    featured: Boolean(o.featured ?? false),
    expectedAudience: sanitizeText(o.expectedAudience ?? o.expected_audience, 200),
    duplicateRisk: toEnum(
      o.duplicateRisk ?? o.duplicate_risk ?? "low",
      RISK_LEVELS,
      "duplicateRisk"
    ),
    rationale: sanitizeText(o.rationale ?? o.reason, 500),
    imageA: validateImagePayload(o.imageA ?? o.image_a ?? o.optionAImage),
    imageB: validateImagePayload(o.imageB ?? o.image_b ?? o.optionBImage),
    coverImage: validateImagePayload(o.coverImage ?? o.cover_image ?? o.coverImageData),
  };
}

export function validateAnalytics(input: unknown): AnalyticsResult {
  const o = asRecord(input, "통계 리포트");
  return {
    reportType: toEnum(o.reportType ?? o.report_type ?? "manual", REPORT_TYPES, "reportType"),
    periodStart: isoDate(o.periodStart ?? o.period_start),
    periodEnd: isoDate(o.periodEnd ?? o.period_end),
    summary: sanitizeText(o.summary, 2000),
    details: sanitizeText(o.details, 4000),
    highlights: asStringArray(o.highlights, 20, 300),
    warnings: asStringArray(o.warnings, 20, 300),
    recommendations: asStringArray(o.recommendations, 20, 300),
  };
}

// A stable hash for poll-draft dedupe: normalize title + both options.
export function draftContentHash(d: {
  title: string;
  optionA: string;
  optionB: string;
}): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const [a, b] = [norm(d.optionA), norm(d.optionB)].sort();
  return `${norm(d.title)}|${a}|${b}`.slice(0, 300);
}
