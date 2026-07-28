import Link from "next/link";
import { getVisibleCategories } from "@/lib/home-data";
import { getVisibleBoards } from "@/lib/community-boards-data";
import { Button } from "@/components/ui/button";

const SORT_OPTIONS = ["latest", "popular", "comments"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
const SORT_LABEL: Record<SortOption, string> = {
  latest: "최신순",
  popular: "인기순",
  comments: "댓글순",
};

function hrefFor(params: { category?: string | null; sort?: SortOption }) {
  const search = new URLSearchParams();
  if (params.category) search.set("category", params.category);
  if (params.sort && params.sort !== "latest") search.set("sort", params.sort);
  const qs = search.toString();
  return qs ? `/?${qs}` : "/";
}

// Async Server Component — fetches the current admin-managed category list
// itself, so every page that renders it (home, poll detail, community)
// stays in sync without threading the list through props.
export async function CategoryNav({ active = null }: { active?: string | null }) {
  const categories = await getVisibleCategories();
  return (
    <nav className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:gap-1">
      <Button
        size="sm"
        variant={active === null ? "default" : "outline"}
        nativeButton={false}
        className="lg:w-full lg:justify-start"
        render={<Link href={hrefFor({ category: null })}>전체</Link>}
      />
      {categories.map((cat) => (
        <Button
          key={cat.id}
          size="sm"
          variant={active === cat.slug ? "default" : "outline"}
          nativeButton={false}
          className="lg:w-full lg:justify-start"
          render={
            <Link href={hrefFor({ category: cat.slug })}>
              {cat.icon ? `${cat.icon} ${cat.name}` : cat.name}
            </Link>
          }
        />
      ))}
    </nav>
  );
}

export async function CommunityNav() {
  const boards = await getVisibleBoards();
  return (
    <nav className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:gap-1">
      <Button
        size="sm"
        variant="ghost"
        nativeButton={false}
        className="lg:w-full lg:justify-start"
        render={<Link href="/community">커뮤니티 홈</Link>}
      />
      {boards.map((board) => (
        <Button
          key={board.id}
          size="sm"
          variant="ghost"
          nativeButton={false}
          className="lg:w-full lg:justify-start"
          render={
            <Link href={`/community/${board.slug}`}>
              {board.icon ? `${board.icon} ${board.name}` : board.name}
            </Link>
          }
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
