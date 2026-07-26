"use client";

import { useActionState } from "react";
import { createPoll, type CreatePollState } from "@/app/polls/actions";
import { POLL_CATEGORIES } from "@/lib/categories";
import { ImageUploadHint } from "@/components/image-upload-hint";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: CreatePollState = { error: null };

export default function NewPollPage() {
  const [state, formAction, pending] = useActionState(createPoll, initialState);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>새 투표 만들기</CardTitle>
          <CardDescription>
            둘 중 하나를 고르는 질문을 만들어보세요. 만든 투표는 관리자 승인 후
            공개됩니다.
          </CardDescription>
        </CardHeader>
        <form action={formAction}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="question">질문</Label>
              <Input
                id="question"
                name="question"
                placeholder="예: 민초 vs 반민초?"
                required
                maxLength={200}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">카테고리</Label>
              <Select name="category" defaultValue="기타">
                <SelectTrigger id="category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLL_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="optionA">선택지 A</Label>
              <Input id="optionA" name="optionA" required maxLength={80} />
              <Input id="imageA" name="imageA" type="file" accept="image/*" />
              <ImageUploadHint recommendedSize="500×500px (정사각형)" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="optionB">선택지 B</Label>
              <Input id="optionB" name="optionB" required maxLength={80} />
              <Input id="imageB" name="imageB" type="file" accept="image/*" />
              <ImageUploadHint recommendedSize="500×500px (정사각형)" />
            </div>
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "만드는 중..." : "투표 만들기"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
