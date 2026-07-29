"use client";

import { useActionState, useState } from "react";
import { adminUpdatePoll, type AdminPollEditState } from "@/app/admin/polls/actions";
import type { CategoryNavItem } from "@/lib/home-data";
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
  categoryId,
  categories,
  optionA,
  optionB,
}: {
  pollId: string;
  question: string;
  categoryId: string;
  categories: CategoryNavItem[];
  optionA: { id: string; label: string };
  optionB: { id: string; label: string };
}) {
  const action = adminUpdatePoll.bind(null, pollId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId);
  const selected = categories.find((c) => c.id === selectedCategoryId) ?? null;

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
        <input type="hidden" name="category_id" value={selectedCategoryId} />
        <Select
          value={selectedCategoryId}
          onValueChange={(value) => setSelectedCategoryId(value ?? "")}
        >
          <SelectTrigger id="category" className="w-full">
            <SelectValue>
              {() => (selected ? (selected.icon ? `${selected.icon} ${selected.name}` : selected.name) : "")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ${c.name}` : c.name}
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
