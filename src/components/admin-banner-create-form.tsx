"use client";

import { useActionState } from "react";
import { createBanner, type BannerFormState } from "@/app/admin/banners/actions";
import { ImageUploadHint } from "@/components/image-upload-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: BannerFormState = { error: null };

export function AdminBannerCreateForm({ kind }: { kind: "event" | "home" }) {
  const action = createBanner.bind(null, kind);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${kind}-title`}>제목</Label>
        <Input id={`${kind}-title`} name="title" maxLength={200} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${kind}-image`}>이미지 (선택)</Label>
        <Input id={`${kind}-image`} name="image" type="file" accept="image/*" />
        <ImageUploadHint recommendedSize="1200×400px (3:1 가로형)" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${kind}-link`}>링크 URL (선택)</Label>
        <Input id={`${kind}-link`} name="link_url" type="url" placeholder="https://" />
      </div>
      {kind === "event" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${kind}-starts`}>시작일 (선택)</Label>
            <Input id={`${kind}-starts`} name="starts_at" type="datetime-local" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${kind}-ends`}>종료일 (선택)</Label>
            <Input id={`${kind}-ends`} name="ends_at" type="datetime-local" />
          </div>
        </div>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "등록 중..." : "배너 등록"}
      </Button>
    </form>
  );
}
