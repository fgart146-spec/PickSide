import { importResults } from "@/app/admin/office/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// 결과 JSON 업로드 / 생성 결과 가져오기 — paste JSON or upload a .json file that
// Claude Code produced. The server validates everything before saving.
export function OfficeImportForm({
  hint,
}: {
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">결과 JSON 가져오기</CardTitle>
        <CardDescription>
          {hint ??
            "Claude Code가 만든 결과 JSON을 붙여넣거나 .json 파일을 업로드하세요. 서버가 검증한 뒤 저장합니다."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={importResults} className="flex flex-col gap-3">
          <textarea
            name="json"
            rows={6}
            placeholder='{"taskType":"poll_draft", ...} 또는 [ ... ]'
            className="w-full rounded-md border bg-background p-2 font-mono text-xs"
          />
          <div className="flex items-center justify-between gap-2">
            <input
              type="file"
              name="file"
              accept="application/json,.json"
              className="text-xs text-muted-foreground"
            />
            <Button type="submit" size="sm">
              가져오기
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
