"use client";

import { useActionState } from "react";
import { updatePost, type PostFormState } from "@/app/community/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: PostFormState = { error: null };

export function CommunityEditForm({
  board,
  postId,
  initialTitle,
  initialBody,
}: {
  board: string;
  postId: string;
  initialTitle: string;
  initialBody: string;
}) {
  const action = updatePost.bind(null, board, postId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>글 수정</CardTitle>
          <CardDescription>제목과 내용을 수정할 수 있어요.</CardDescription>
        </CardHeader>
        <form action={formAction}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                name="title"
                required
                maxLength={120}
                defaultValue={initialTitle}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="body">내용</Label>
              <textarea
                id="body"
                name="body"
                required
                maxLength={5000}
                rows={8}
                defaultValue={initialBody}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "저장 중..." : "저장"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
