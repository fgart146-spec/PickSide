export const POLL_CATEGORIES = ["일상", "음식", "연애", "게임", "밸런스", "기타"] as const;

export type PollCategory = (typeof POLL_CATEGORIES)[number];

export function isPollCategory(value: string): value is PollCategory {
  return (POLL_CATEGORIES as readonly string[]).includes(value);
}

// polls.category (the legacy enum) is kept NOT NULL for backward
// compatibility. When an admin-picked category's name matches one of the
// original 6, mirror it there too; otherwise fall back to '기타'.
export function legacyCategoryFor(name: string): PollCategory {
  return isPollCategory(name) ? name : "기타";
}

// ---------------------------------------------------------------------------
// Dynamic (DB-managed) categories — see the `categories` table. The
// PollCategory union above stays as the legacy enum type backing
// polls.category and the per-category visual system (poll-visuals.ts); it
// is not extended when an admin adds a new category.
// ---------------------------------------------------------------------------

export const UNCATEGORIZED_SLUG = "uncategorized";

export function slugifyCategoryName(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `category-${Math.random().toString(36).slice(2, 8)}`;
}

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number;
  is_visible: boolean;
  show_on_home: boolean;
  is_system: boolean;
  is_deleted: boolean;
};
