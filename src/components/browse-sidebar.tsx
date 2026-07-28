import { CategoryNav, CommunityNav, SortNav, type SortOption } from "@/components/browse-nav";

/**
 * Left rail shared by the home, poll, and community pages so the category /
 * community / sort navigation stays visible everywhere (desktop only).
 */
export function BrowseSidebar({
  activeCategory = null,
  activeSort = "latest",
}: {
  activeCategory?: string | null;
  activeSort?: SortOption;
}) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:gap-6">
      <div className="flex flex-col gap-1">
        <span className="mb-1 text-xs font-medium text-muted-foreground">카테고리</span>
        <CategoryNav active={activeCategory} />
      </div>
      <div className="flex flex-col gap-1 border-t pt-4">
        <span className="mb-1 text-xs font-medium text-muted-foreground">커뮤니티</span>
        <CommunityNav />
      </div>
      <div className="flex flex-col gap-1 border-t pt-4">
        <span className="mb-1 text-xs font-medium text-muted-foreground">정렬</span>
        <SortNav active={activeSort} />
      </div>
    </aside>
  );
}
