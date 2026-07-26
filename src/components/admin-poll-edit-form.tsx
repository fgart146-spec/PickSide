"use client";

import { useActionState } from "react";
import { adminUpdatePoll, type AdminPollEditState } from "@/app/admin/polls/actions";
import { POLL_CATEGORIES } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: AdminPollEditState = { error: null };

export function AdminPollEditForm({
  pollId,
  question,
  category,
  optionA,
  optionB,
}: {
  pollId: string;
  question: string;
  category: string;
  optionA: { id: string; label: string };
  optionB: { id: string; label: string };
}) {
  const action = adminUpdatePoll.bind(null, pollId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="optionAId" value={optionA.id} />
      <input type="hidden" name="optionBId" value={optionB.id} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="question">질문</Label>
        <Input id="question" name="question" defaultValue={question} maxLength={200} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">카테고리</Label>
        <Select name="category" defaultValue={category}>
          <SelectTrigger id="category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POLL_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="optionALabel">선택지 A</Label>
        <Input
          id="optionALabel"
          name="optionALabel"
          defaultValue={optionA.label}
          maxLength={80}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="optionBLabel">선택지 B</Label>
        <Input
          id="optionBLabel"
          name="optionBLabel"
          defaultValue={optionB.label}
          maxLength={80}
          required
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "저장 중..." : "수정 사항 저장"}
      </Button>
    </form>
  );
}
