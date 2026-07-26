"use client";

import { useActionState } from "react";
import { createNotice, type NoticeFormState } from "@/app/admin/notices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: NoticeFormState = { error: null };

export function AdminNoticeCreateForm() {
  const [state, formAction, pending] = useActionState(createNotice, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Input name="title" placeholder="제목" maxLength={200} required />
      <textarea
        name="body"
        placeholder="내용"
        rows={4}
        maxLength={5000}
        required
        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "등록 중..." : "공지 등록"}
      </Button>
    </form>
  );
}
