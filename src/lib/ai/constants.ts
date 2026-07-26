// Shared, framework-agnostic constants for the AI office. Safe to import from
// both server and client components (no "server-only" here).

import { ShieldIcon, PencilIcon, BarChart3Icon, type LucideIcon } from "lucide-react";

export type AiWorker = "report_review" | "content_plan" | "analytics";

export const AI_WORKER_META: Record<
  AiWorker,
  { icon: LucideIcon; name: string; job: string; href: string }
> = {
  report_review: {
    icon: ShieldIcon,
    name: "신고 검토관",
    job: "신고와 신고 대상 콘텐츠를 분석해 처리 방향을 추천합니다. (직접 처리는 하지 않음)",
    href: "/admin/office/reports",
  },
  content_plan: {
    icon: PencilIcon,
    name: "콘텐츠 기획자",
    job: "양자택일 투표 초안을 만들어 pending 상태로 저장합니다.",
    href: "/admin/office/drafts",
  },
  analytics: {
    icon: BarChart3Icon,
    name: "통계 분석가",
    job: "실제 수집된 데이터만으로 읽기 전용 운영 리포트를 만듭니다.",
    href: "/admin/office/analytics",
  },
};

// 🛡️ 신고 검토관 — 추천 조치
export const REPORT_ACTIONS = [
  "dismiss",
  "keep",
  "hide",
  "delete",
  "reclassify_adult",
  "change_category",
  "warn_author",
  "admin_review",
] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

export const REPORT_ACTION_LABEL: Record<ReportAction, string> = {
  dismiss: "신고 기각",
  keep: "콘텐츠 유지",
  hide: "콘텐츠 숨김",
  delete: "콘텐츠 삭제",
  reclassify_adult: "성인 콘텐츠로 재분류",
  change_category: "카테고리 변경",
  warn_author: "작성자 경고",
  admin_review: "관리자 추가 검토 필요",
};

// 신고 검토관 처리 상태
export const REPORT_REVIEW_STATUS = [
  "pending_analysis",
  "analyzed",
  "admin_reviewing",
  "resolved",
  "held",
] as const;
export type ReportReviewStatus = (typeof REPORT_REVIEW_STATUS)[number];

export const REPORT_REVIEW_STATUS_LABEL: Record<ReportReviewStatus, string> = {
  pending_analysis: "분석 대기",
  analyzed: "AI 분석 완료",
  admin_reviewing: "관리자 검토 중",
  resolved: "처리 완료",
  held: "보류",
};

// ✍️ 콘텐츠 기획자 — 초안 상태
export const DRAFT_STATUS = [
  "pending",
  "approved",
  "published",
  "rejected",
  "archived",
] as const;
export type DraftStatus = (typeof DRAFT_STATUS)[number];

export const DRAFT_STATUS_LABEL: Record<DraftStatus, string> = {
  pending: "검토 대기",
  approved: "승인 완료",
  published: "게시 완료",
  rejected: "거절",
  archived: "보관",
};

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};

export const DUPLICATE_LABEL: Record<RiskLevel, string> = {
  low: "중복 가능성 낮음",
  medium: "중복 가능성 보통",
  high: "중복 가능성 높음",
};

// 📊 통계 분석가 — 리포트 주기
export const REPORT_TYPES = ["manual", "daily", "weekly", "monthly"] as const;
export type AnalyticsReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABEL: Record<AnalyticsReportType, string> = {
  manual: "직접 생성",
  daily: "일간 리포트",
  weekly: "주간 리포트",
  monthly: "월간 리포트",
};

// 공통 작업 상태
export const JOB_STATUS = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUS)[number];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  queued: "대기",
  running: "실행 중",
  completed: "완료",
  failed: "실패",
  cancelled: "취소됨",
};

// Result JSON 의 taskType → worker 매핑 (import 시 검증에 사용).
export const TASK_TYPE_TO_WORKER: Record<string, AiWorker> = {
  report_review: "report_review",
  poll_draft: "content_plan",
  analytics_report: "analytics",
};
