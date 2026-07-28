import { deleteCategory } from "@/app/admin/categories/actions";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string };

// Native <details>/<summary> disclosure instead of client useState — no
// hydration required, so this works exactly as reliably as the plain
// server-action forms elsewhere on this page (progressive enhancement).
export function AdminCategoryDeleteButton({
  categoryId,
  categoryName,
  pollCount,
  otherCategories,
}: {
  categoryId: string;
  categoryName: string;
  pollCount: number;
  otherCategories: Option[];
}) {
  return (
    <details className="w-full">
      <summary className="inline-flex h-7 cursor-pointer list-none items-center rounded-lg px-2.5 text-[0.8rem] font-medium text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
        삭제
      </summary>
      <form
        action={deleteCategory.bind(null, categoryId)}
        className="mt-2 flex w-full flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
      >
        <p>
          <strong>{categoryName}</strong> 카테고리에 등록된 투표 <strong>{pollCount}개</strong>가
          있습니다.
        </p>
        <p className="text-muted-foreground">
          삭제해도 투표는 지워지지 않고, 아래에서 선택한 카테고리로 이동합니다 (기본값: 미분류).
          삭제된 카테고리는 나중에 복원할 수 있습니다.
        </p>
        <select
          name="reassign_to"
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          defaultValue=""
        >
          <option value="">미분류로 이동</option>
          {otherCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}(으)로 이동
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
