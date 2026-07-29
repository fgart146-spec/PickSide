"use client";

import { useActionState } from "react";
import {
  updateContactSettings,
  type ContactSettingsFormState,
} from "@/app/admin/contact-settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ContactSettingsFormState = { error: null };

export function AdminContactSettingsForm({
  enabled,
  label,
  description,
  url,
  openNewTab,
}: {
  enabled: boolean;
  label: string;
  description: string;
  url: string;
  openNewTab: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateContactSettings, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="businessInquiryEnabled"
          defaultChecked={enabled}
          className="size-4"
        />
        비즈니스 문의 활성화
      </label>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="businessInquiryLabel">버튼 문구</Label>
        <Input
          id="businessInquiryLabel"
          name="businessInquiryLabel"
          defaultValue={label}
          maxLength={100}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="businessInquiryDescription">안내 문구</Label>
        <Input
          id="businessInquiryDescription"
          name="businessInquiryDescription"
          defaultValue={description}
          maxLength={200}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="businessInquiryUrl">외부 링크 (카카오톡 오픈채팅 등)</Label>
        <Input
          id="businessInquiryUrl"
          name="businessInquiryUrl"
          defaultValue={url}
          placeholder="https://open.kakao.com/o/..."
          required
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="businessInquiryOpenNewTab"
          defaultChecked={openNewTab}
          className="size-4"
        />
        새 탭에서 열기
      </label>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "저장 중..." : "저장"}
      </Button>
    </form>
  );
}
