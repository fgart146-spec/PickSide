"use client";

import { useActionState, useState } from "react";
import { createPoll, type CreatePollState } from "@/app/polls/actions";
import { OptionComposer } from "@/components/option-composer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CategoryNavItem } from "@/lib/home-data";

const initialState: CreatePollState = { error: null };

export function NewPollForm({ categories }: { categories: CategoryNavItem[] }) {
  const [state, formAction, pending] = useActionState(createPoll, initialState);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const selected = categories.find((c) => c.id === categoryId) ?? null;

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:py-12">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">새 VS 투표 만들기</CardTitle>
          <CardDescription>
            두 장의 사진으로 둘 중 하나를 고르는 질문을 만들어보세요. 만든 투표는
            관리자 승인 후 공개됩니다.
          </CardDescription>
        </CardHeader>

        <form action={formAction}>
          <CardContent className="flex flex-col gap-6">
            {/* Question */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="question">질문</Label>
              <Input
                id="question"
                name="question"
                placeholder="예: 여름 vs 겨울?"
                required
                maxLength={200}
              />
            </div>

            {/* Category (controlled so previews reflect it live) — the list
                comes straight from the admin-managed categories table. */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">카테고리</Label>
              <input type="hidden" name="category_id" value={categoryId} />
              <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? "")}>
                <SelectTrigger id="category" className="w-full">
                  <SelectValue>
                    {() =>
                      selected ? (selected.icon ? `${selected.icon} ${selected.name}` : selected.name) : ""
                    }
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
              <p className="text-xs text-muted-foreground">
                이미지를 올리지 않으면 카테고리에 맞는 컬러 카드가 자동으로 표시돼요.
              </p>
            </div>

            <Separator />

            <OptionComposer
              side="A"
              category={selected?.name ?? "기타"}
              categoryColor={selected?.color ?? null}
              imageName="imageA"
              labelName="optionA"
              title="선택지 A"
              placeholder="예: 여름"
            />

            <Separator />

            <OptionComposer
              side="B"
              category={selected?.name ?? "기타"}
              categoryColor={selected?.color ?? null}
              imageName="imageB"
              labelName="optionB"
              title="선택지 B"
              placeholder="예: 겨울"
            />

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          </CardContent>

          <CardFooter>
            <Button type="submit" className="w-full" disabled={pending || !categoryId}>
              {pending ? "만드는 중..." : "투표 만들기"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
