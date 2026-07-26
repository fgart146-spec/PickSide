"use client";

import { useActionState } from "react";
import { updateUsername, type UpdateUsernameState } from "@/app/me/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: UpdateUsernameState = { error: null, success: false };

export function UsernameForm({ currentUsername }: { currentUsername: string }) {
  const [state, formAction, pending] = useActionState(updateUsername, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="username">닉네임</Label>
        <Input
          id="username"
          name="username"
          defaultValue={currentUsername}
          minLength={2}
          maxLength={20}
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "저장 중..." : "변경"}
      </Button>
      {state.error && <p className="text-sm text-destructive sm:basis-full">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-primary sm:basis-full">닉네임이 변경됐습니다.</p>
      )}
    </form>
  );
}
