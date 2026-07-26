"use client";

import { useActionState } from "react";
import { createPost, type PostFormState } from "@/app/community/actions";
import { BOARD_LABEL, type CommunityBoard } from "@/lib/community-boards";
import { ImageUploadHint } from "@/components/image-upload-hint";
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

export function CommunityPostForm({ board }: { board: CommunityBoard }) {
  const action = createPost.bind(null, board);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{BOARD_LABEL[board]} 글쓰기</CardTitle>
          <CardDescription>제목과 내용을 입력해주세요.</CardDescription>
        </CardHeader>
        <form action={formAction} encType="multipart/form-data">
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">제목</Label>
              <Input id="title" name="title" required maxLength={120} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="body">내용</Label>
              <textarea
                id="body"
                name="body"
                required
                maxLength={5000}
                rows={8}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="image">이미지 (선택)</Label>
              <Input id="image" name="image" type="file" accept="image/*" />
              <ImageUploadHint recommendedSize="800×600px 이하" />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "작성 중..." : "작성 완료"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
