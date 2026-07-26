"use client";

import { useActionState } from "react";
import { createPopup, type PopupFormState } from "@/app/admin/popups/actions";
import { ImageUploadHint } from "@/components/image-upload-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PopupFormState = { error: null };

export function AdminPopupCreateForm() {
  const [state, formAction, pending] = useActionState(createPopup, initialState);

  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="popup-title">제목</Label>
        <Input id="popup-title" name="title" maxLength={200} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="popup-body">내용 (선택)</Label>
        <textarea
          id="popup-body"
          name="body"
          rows={3}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="popup-image">이미지 (선택)</Label>
        <Input id="popup-image" name="image" type="file" accept="image/*" />
        <ImageUploadHint recommendedSize="600×800px (3:4 세로형)" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="popup-link">링크 URL (선택)</Label>
        <Input id="popup-link" name="link_url" type="url" placeholder="https://" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="popup-starts">시작일 (선택)</Label>
          <Input id="popup-starts" name="starts_at" type="datetime-local" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="popup-ends">종료일 (선택)</Label>
          <Input id="popup-ends" name="ends_at" type="datetime-local" />
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "등록 중..." : "팝업 등록"}
      </Button>
    </form>
  );
}
