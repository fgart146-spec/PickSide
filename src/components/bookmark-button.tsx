import { BookmarkIcon, BookmarkCheckIcon } from "lucide-react";
import { toggleBookmark } from "@/app/polls/actions";
import { Button } from "@/components/ui/button";

export function BookmarkButton({
  pollId,
  bookmarked,
}: {
  pollId: string;
  bookmarked: boolean;
}) {
  return (
    <form action={toggleBookmark.bind(null, pollId)}>
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        aria-label={bookmarked ? "북마크 해제" : "북마크"}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1"
      >
        {bookmarked ? (
          <BookmarkCheckIcon className="size-4 text-primary" />
        ) : (
          <BookmarkIcon className="size-4" />
        )}
      </Button>
    </form>
  );
}
