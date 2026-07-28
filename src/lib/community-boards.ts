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

// ---------------------------------------------------------------------------
// Dynamic (DB-managed) boards — see the `community_boards` table. The
// CommunityBoard union above stays as the legacy enum type backing
// community_posts.board; it is not extended when an admin adds a new board.
// ---------------------------------------------------------------------------

export const ARCHIVE_BOARD_SLUG = "archive";

export function slugifyBoardName(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `board-${Math.random().toString(36).slice(2, 8)}`;
}

export type CommunityBoardRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number;
  is_visible: boolean;
  allow_posts: boolean;
  allow_comments: boolean;
  allow_images: boolean;
  allow_anonymous: boolean;
  allow_guest_view: boolean;
  admin_only_posting: boolean;
  is_system: boolean;
  is_deleted: boolean;
};
