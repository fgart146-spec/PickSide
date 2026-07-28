"use client";

import { useActionState } from "react";
import { updatePolicyDocument, type PolicyFormState } from "@/app/admin/policies/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PolicyFormState = { error: null };

export function AdminPolicyEditForm({
  slug,
  title,
  body,
}: {
  slug: string;
  title: string;
  body: string;
}) {
  const action = updatePolicyDocument.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" required defaultValue={title} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="body">내용</Label>
        <textarea
          id="body"
          name="body"
          required
          rows={24}
          defaultValue={body}
          className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "저장 중..." : "저장"}
      </Button>
    </form>
  );
}
