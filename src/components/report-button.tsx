"use client";

import { useActionState, useState } from "react";
import type { ReportState } from "@/app/reports/actions";
import { Button } from "@/components/ui/button";

const initialState: ReportState = { error: null, success: false };

export function ReportButton({
  action,
}: {
  action: (prevState: ReportState, formData: FormData) => Promise<ReportState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.success) {
    return <p className="text-xs text-muted-foreground">신고가 접수됐습니다.</p>;
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        신고
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="reason"
        placeholder="신고 사유를 입력해주세요"
        maxLength={300}
        required
        rows={2}
        className="w-full resize-none rounded-md border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          취소
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "접수 중..." : "신고 제출"}
        </Button>
      </div>
    </form>
  );
}
