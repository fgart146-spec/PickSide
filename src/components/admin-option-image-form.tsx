"use client";

import { useActionState } from "react";
import { adminReplaceOptionImage, type AdminImageState } from "@/app/admin/polls/actions";
import { ImageUploadHint } from "@/components/image-upload-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: AdminImageState = { error: null };

export function AdminOptionImageForm({
  pollId,
  optionId,
}: {
  pollId: string;
  optionId: string;
}) {
  const action = adminReplaceOptionImage.bind(null, pollId, optionId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-1">
      <Input name="image" type="file" accept="image/*" required />
      <ImageUploadHint recommendedSize="500×500px (정사각형)" />
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "업로드 중..." : "이미지 교체"}
      </Button>
    </form>
  );
}
