import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PAGE_SIZE = 10;

/**
 * Parse a 1-based page number from a raw search param.
 */
export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/**
 * Prev / next pager. `makeHref(page)` builds the target URL while preserving
 * the caller's other query params. Renders nothing on a single page.
 */
export function Pagination({
  page,
  hasNext,
  makeHref,
}: {
  page: number;
  hasNext: boolean;
  makeHref: (page: number) => string;
}) {
  if (page <= 1 && !hasNext) return null;

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      {page > 1 ? (
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={
            <Link href={makeHref(page - 1)}>
              <ChevronLeftIcon />
              이전
            </Link>
          }
        />
      ) : (
        <Button size="sm" variant="outline" disabled>
          <ChevronLeftIcon />
          이전
        </Button>
      )}
      <span className="text-sm text-muted-foreground">{page} 페이지</span>
      {hasNext ? (
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={
            <Link href={makeHref(page + 1)}>
              다음
              <ChevronRightIcon />
            </Link>
          }
        />
      ) : (
        <Button size="sm" variant="outline" disabled>
          다음
          <ChevronRightIcon />
        </Button>
      )}
    </div>
  );
}
