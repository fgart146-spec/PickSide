export const POLL_CATEGORIES = ["일상", "음식", "연애", "게임", "밸런스", "기타"] as const;

export type PollCategory = (typeof POLL_CATEGORIES)[number];

export function isPollCategory(value: string): value is PollCategory {
  return (POLL_CATEGORIES as readonly string[]).includes(value);
}
