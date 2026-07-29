"use client";

import { useActionState } from "react";
import { updateInquiryNote, type InquiryNoteState } from "@/app/admin/inquiries/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: InquiryNoteState = { error: null };

export function AdminInquiryNoteForm({
  inquiryId,
  note,
}: {
  inquiryId: string;
  note: string | null;
}) {
  const action = updateInquiryNote.bind(null, inquiryId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <Label htmlFor="adminNote">관리자 메모</Label>
      <textarea
        id="adminNote"
        name="adminNote"
        defaultValue={note ?? ""}
        rows={3}
        maxLength={2000}
        placeholder="내부 참고용 메모 (문의자에게 보이지 않음)"
        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending} className="self-start">
        {pending ? "저장 중..." : "메모 저장"}
      </Button>
    </form>
  );
}
