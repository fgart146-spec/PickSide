"use client";

import { useActionState } from "react";
import { updateAdSlot, type AdSlotFormState } from "@/app/admin/ad-slots/actions";
import { AD_SLOT_RECOMMENDED_SIZE, type AdSlotKey } from "@/lib/ad-slots";
import { ImageUploadHint } from "@/components/image-upload-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AdSlotFormState = { error: null };

export function AdminAdSlotForm({
  slotKey,
  linkUrl,
  isActive,
}: {
  slotKey: AdSlotKey;
  linkUrl: string | null;
  isActive: boolean;
}) {
  const action = updateAdSlot.bind(null, slotKey);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${slotKey}-image`}>이미지 교체 (선택)</Label>
        <Input id={`${slotKey}-image`} name="image" type="file" accept="image/*" />
        <ImageUploadHint recommendedSize={AD_SLOT_RECOMMENDED_SIZE[slotKey]} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${slotKey}-link`}>링크 URL</Label>
        <Input
          id={`${slotKey}-link`}
          name="link_url"
          type="url"
          placeholder="https://"
          defaultValue={linkUrl ?? ""}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={isActive} className="size-4" />
        노출 활성화
      </label>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "저장 중..." : "저장"}
      </Button>
    </form>
  );
}
