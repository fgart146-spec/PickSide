import Link from "next/link";
import { POLL_CATEGORIES, type PollCategory } from "@/lib/categories";
import { COMMUNITY_BOARDS, BOARD_LABEL } from "@/lib/community-boards";
import { Button } from "@/components/ui/button";

const SORT_OPTIONS = ["latest", "popular", "comments"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
const SORT_LABEL: Record<SortOption, string> = {
  latest: "최신순",
  popular: "인기순",
  comments: "댓글순",
};

function hrefFor(params: { category?: PollCategory | null; sort?: SortOption }) {
  const search = new URLSearchParams();
  if (params.category) search.set("category", params.category);
  if (params.sort && params.sort !== "latest") search.set("sort", params.sort);
  const qs = search.toString();
  return qs ? `/?${qs}` : "/";
}

export function CategoryNav({ active = null }: { active?: PollCategory | null }) {
  return (
    <nav className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:gap-1">
      <Button
        size="sm"
        variant={active === null ? "default" : "outline"}
        nativeButton={false}
        className="lg:w-full lg:justify-start"
        render={<Link href={hrefFor({ category: null })}>전체</Link>}
      />
      {POLL_CATEGORIES.map((cat) => (
        <Button
          key={cat}
          size="sm"
          variant={active === cat ? "default" : "outline"}
          nativeButton={false}
          className="lg:w-full lg:justify-start"
          render={<Link href={hrefFor({ category: cat })}>{cat}</Link>}
        />
      ))}
    </nav>
  );
}

export function CommunityNav() {
  return (
    <nav className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:gap-1">
      <Button
        size="sm"
        variant="ghost"
        nativeButton={false}
        className="lg:w-full lg:justify-start"
        render={<Link href="/community">커뮤니티 홈</Link>}
      />
      {COMMUNITY_BOARDS.map((board) => (
        <Button
          key={board}
          size="sm"
          variant="ghost"
          nativeButton={false}
          className="lg:w-full lg:justify-start"
          render={<Link href={`/community/${board}`}>{BOARD_LABEL[board]}</Link>}
        />
      ))}
    </nav>
  );
}

export function SortNav({ active = "latest" }: { active?: SortOption }) {
  return (
    <nav className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:gap-1">
      {SORT_OPTIONS.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={active === option ? "default" : "ghost"}
          nativeButton={false}
          className="lg:w-full lg:justify-start"
          render={<Link href={hrefFor({ sort: option })}>{SORT_LABEL[option]}</Link>}
        />
      ))}
    </nav>
  );
}
