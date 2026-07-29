export const INQUIRY_TYPES = ["general", "bug", "ad", "partnership"] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];

export const INQUIRY_TYPE_LABEL: Record<InquiryType, string> = {
  general: "일반 문의",
  bug: "버그 제보",
  ad: "광고 문의",
  partnership: "제휴 문의",
};

export const INQUIRY_TYPE_DESCRIPTION: Record<InquiryType, string> = {
  general: "서비스 이용 중 궁금한 점을 남겨주세요.",
  bug: "발견한 오류나 이상 동작을 알려주세요.",
  ad: "배너/지면 광고 진행을 문의해주세요.",
  partnership: "제휴·협업을 제안해주세요.",
};

export const AD_POSITION_OPTIONS = [
  "PC 상단 배너",
  "PC 우측 사이드바",
  "콘텐츠 중간 광고",
  "투표 상세 하단 광고",
  "모바일 광고",
  "기타",
];

export const INQUIRY_STATUSES = ["received", "in_review", "answered", "on_hold", "spam"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_STATUS_LABEL: Record<string, string> = {
  received: "접수",
  in_review: "확인 중",
  answered: "답변 완료",
  on_hold: "보류",
  spam: "스팸",
};

// ---------------------------------------------------------------------------
// Admin-managed extra contact channels (contact_channels table) — icon key
// stored in the DB, mapped to an actual lucide component only at render
// time (see contact-channel-icon.tsx) so this list stays a plain string
// union with no React import.
// ---------------------------------------------------------------------------
export const CONTACT_CHANNEL_ICONS = [
  "kakao",
  "email",
  "instagram",
  "discord",
  "naver_talk",
  "phone",
  "link",
] as const;
export type ContactChannelIcon = (typeof CONTACT_CHANNEL_ICONS)[number];

export const CONTACT_CHANNEL_ICON_LABEL: Record<ContactChannelIcon, string> = {
  kakao: "카카오톡",
  email: "이메일",
  instagram: "인스타그램",
  discord: "디스코드",
  naver_talk: "네이버 톡톡",
  phone: "전화",
  link: "기타 링크",
};

// ---------------------------------------------------------------------------
// Spam guard for the public contact form: a honeypot field, a short
// per-email cooldown, and a per-IP daily cap. Deliberately lightweight
// (no dedicated rate-limit table) — matches the "최소한의 방어" ask; a
// full security audit is a separate, later effort.
// ---------------------------------------------------------------------------

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isReasonableLength(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}
