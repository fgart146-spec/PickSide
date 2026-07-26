"use client";

import { useActionState, useRef } from "react";
import { createComment, type CommentState } from "@/app/comments/actions";
import { Button } from "@/components/ui/button";

const initialState: CommentState = { error: null };

export function CommentForm({ pollId }: { pollId: string }) {
  const action = createComment.bind(null, pollId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        name="body"
        placeholder="댓글을 남겨보세요"
        maxLength={500}
        required
        rows={2}
        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" className="self-end" disabled={pending}>
        {pending ? "등록 중..." : "댓글 등록"}
      </Button>
    </form>
  );
}
