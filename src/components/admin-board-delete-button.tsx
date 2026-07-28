import { deleteBoard } from "@/app/admin/community/boards/actions";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string };

// Native <details>/<summary> disclosure — no client JS/hydration needed
// (see the equivalent category delete button for why this pattern was
// chosen over a useState toggle).
export function AdminBoardDeleteButton({
  boardId,
  boardName,
  postCount,
  otherBoards,
}: {
  boardId: string;
  boardName: string;
  postCount: number;
  otherBoards: Option[];
}) {
  return (
    <details className="w-full">
      <summary className="inline-flex h-7 cursor-pointer list-none items-center rounded-lg px-2.5 text-[0.8rem] font-medium text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
        삭제
      </summary>
      <form
        action={deleteBoard.bind(null, boardId)}
        className="mt-2 flex w-full flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
      >
        <p>
          <strong>{boardName}</strong> 게시판에 등록된 게시글 <strong>{postCount}개</strong>가
          있습니다.
        </p>
        <p className="text-muted-foreground">
          삭제해도 게시글은 지워지지 않고, 아래에서 선택한 게시판으로 이동합니다 (기본값: 보관
          게시판). 삭제된 게시판은 나중에 복원할 수 있습니다.
        </p>
        <select
          name="reassign_to"
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          defaultValue=""
        >
          <option value="">보관 게시판으로 이동</option>
          {otherBoards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}(으)로 이동
            </option>
          ))}
        </select>
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="destructive">
            삭제 확정
          </Button>
        </div>
      </form>
    </details>
  );
}
