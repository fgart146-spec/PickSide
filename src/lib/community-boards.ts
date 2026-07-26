export const COMMUNITY_BOARDS = [
  "free",
  "humor",
  "question",
  "balance_suggestion",
] as const;

export type CommunityBoard = (typeof COMMUNITY_BOARDS)[number];

export const BOARD_LABEL: Record<CommunityBoard, string> = {
  free: "자유게시판",
  humor: "유머게시판",
  question: "고민/질문게시판",
  balance_suggestion: "밸런스 게임 주제 추천",
};

export function isCommunityBoard(value: string): value is CommunityBoard {
  return (COMMUNITY_BOARDS as readonly string[]).includes(value);
}
